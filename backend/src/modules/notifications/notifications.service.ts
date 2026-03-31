import { InjectRepository } from "@nestjs/typeorm";
import { Injectable } from "@nestjs/common";
import { Repository } from "typeorm";
import { NotificationEntity } from "../../entities/notification.entity";

@Injectable()
export class NotificationsService {
  constructor(
    @InjectRepository(NotificationEntity)
    private readonly repo: Repository<NotificationEntity>
  ) {}

  async sendEmail(subject: string, to: string, body: string) {
    const entity = await this.repo.save({
      channel: "email",
      target: to,
      content: JSON.stringify({ subject, body }),
      createdAt: new Date()
    });
    return entity;
  }

  async sendInApp(userId: string, title: string, content: string) {
    const entity = await this.repo.save({
      channel: "in_app",
      target: userId,
      content: JSON.stringify({ title, content }),
      createdAt: new Date()
    });
    return entity;
  }
}
