import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import {
  type CreateRescueAssignmentDto as ICreateRescueAssignmentDto,
  type UpdateMissionStatusDto as IUpdateMissionStatusDto,
  MISSION_STATUS,
  type MissionStatus,
} from '@repo/types';

export class CreateRescueAssignmentDto implements ICreateRescueAssignmentDto {
  @IsString()
  @IsNotEmpty()
  disasterEventId!: string;

  @IsString()
  @IsNotEmpty()
  districtCode!: string;

  @IsString()
  @IsNotEmpty()
  rescueTeamId!: string;

  @IsString()
  @IsNotEmpty()
  emergencyLocation!: string;

  @IsString()
  @IsOptional()
  assignedBy?: string;
}

export class UpdateMissionStatusDto implements IUpdateMissionStatusDto {
  @IsEnum(MISSION_STATUS)
  status!: MissionStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  leaderId?: string;
}

export class ValidateDispatchDto {
  @IsString()
  @IsNotEmpty()
  disasterEventId!: string;

  @IsString()
  @IsNotEmpty()
  districtCode!: string;

  @IsString()
  @IsNotEmpty()
  rescueTeamId!: string;

  @IsString()
  @IsNotEmpty()
  emergencyLocation!: string;
}
