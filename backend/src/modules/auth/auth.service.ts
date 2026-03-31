import { InjectRepository } from "@nestjs/typeorm";
import { Injectable, OnModuleInit, UnauthorizedException } from "@nestjs/common";
import { In, Repository } from "typeorm";
import { JwtService } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { RoleEntity } from "../../entities/role.entity";
import { UserEntity } from "../../entities/user.entity";

/** 可作为工单处理人的内部账号角色（与 listAssignableUsers 一致） */
export const ASSIGNABLE_HANDLER_ROLE_CODES = ["admin", "finance", "customer_service"] as const;

export type AssignableUserDto = {
  id: number;
  username: string;
  displayName: string;
  roleCode: string;
};

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(UserEntity)
    private readonly usersRepo: Repository<UserEntity>,
    @InjectRepository(RoleEntity)
    private readonly rolesRepo: Repository<RoleEntity>,
    private readonly jwt: JwtService
  ) {}

  async onModuleInit() {
    // Seed default roles + admin user for MVP.
    const roles = [
      { code: "admin", name: "物业管理员" },
      { code: "finance", name: "财务专员" },
      { code: "customer_service", name: "客服/前台" }
    ];
    for (const r of roles) {
      const exist = await this.rolesRepo.findOne({ where: { code: r.code } });
      if (!exist) await this.rolesRepo.save(r);
    }

    const adminUsername = process.env.ADMIN_USERNAME || "admin";
    const adminDisplayName = process.env.ADMIN_DISPLAY_NAME || "管理员";
    const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
    const adminRoleCode = "admin";

    let admin = await this.usersRepo.findOne({ where: { username: adminUsername } });
    if (!admin) {
      admin = await this.usersRepo.save({
        username: adminUsername,
        displayName: adminDisplayName,
        roleCode: adminRoleCode,
        passwordHash: await bcrypt.hash(adminPassword, 10),
        createdAt: new Date()
      });
    } else if (!admin.passwordHash) {
      admin.passwordHash = await bcrypt.hash(adminPassword, 10);
      await this.usersRepo.save(admin);
    }
  }

  async login(username: string, password: string) {
    const user = await this.usersRepo.findOne({ where: { username } });
    if (!user) throw new UnauthorizedException("账号或者密码错误");

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) throw new UnauthorizedException("账号或者密码错误");

    const token = await this.jwt.signAsync({
      sub: user.id,
      username: user.username,
      roleCode: user.roleCode
    });

    return { accessToken: token };
  }

  /** 派单下拉：返回可接单的内部用户（物业侧账号） */
  async listAssignableUsers(): Promise<AssignableUserDto[]> {
    const rows = await this.usersRepo.find({
      where: { roleCode: In([...ASSIGNABLE_HANDLER_ROLE_CODES]) },
      order: { displayName: "ASC" },
      select: ["id", "username", "displayName", "roleCode"]
    });
    return rows.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName,
      roleCode: u.roleCode
    }));
  }
}

