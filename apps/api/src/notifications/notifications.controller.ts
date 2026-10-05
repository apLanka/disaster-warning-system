import { Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiSecurity, ApiTags } from '@nestjs/swagger';

import type { NotificationDto } from '@repo/types';

import { ReporterId } from '../common/decorators/reporter-id.decorator.js';
import { ListNotificationsQueryDto } from './dto/list-notifications-query.dto.js';
import { toNotificationDto } from './notification.mapper.js';
import { NotificationService } from './notification.service.js';

@ApiTags('notifications')
@ApiSecurity('reporter-id')
@ApiHeader({ name: 'x-reporter-id', description: 'Device-generated UUID' })
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly service: NotificationService) {}

  @Get()
  @ApiOperation({ summary: "The caller's notifications, newest first" })
  async list(
    @ReporterId() reporterId: string,
    @Query() query: ListNotificationsQueryDto,
  ): Promise<NotificationDto[]> {
    const notifications = await this.service.listForReporter(reporterId, {
      unreadOnly: query.unread,
      limit: query.limit,
    });
    return notifications.map(toNotificationDto);
  }

  @Patch(':id/read')
  @ApiOperation({ summary: "Mark one of the caller's notifications as read" })
  async markRead(
    @ReporterId() reporterId: string,
    @Param('id') id: string,
  ): Promise<NotificationDto> {
    return toNotificationDto(await this.service.markRead(id, reporterId));
  }
}
