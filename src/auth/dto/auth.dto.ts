import { IsEmail, IsEnum, IsOptional, IsString, Length, MinLength } from 'class-validator';
import { UserRole } from '../entities/user.entity';

export class RegisterDto {
    @IsEmail()
    email!: string;

    @IsString()
    @MinLength(6)
    password!: string;

    @IsString()
    @IsOptional()
    fullName?: string;

    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;

    @IsString()
    @IsOptional()
    walletAddress?: string;

    @IsString()
    @IsOptional()
    organization?: string;
}

export class LoginDto {
    @IsEmail()
    email!: string;

    @IsString()
    password!: string;
}

export class Web3LoginDto {
    @IsString()
    walletAddress!: string;

    @IsString()
    signature!: string;

    @IsString()
    message!: string;

    @IsEnum(UserRole)
    @IsOptional()
    role?: UserRole;

    @IsString()
    @IsOptional()
    organization?: string;
}

export class ForgotPasswordDto {
    @IsEmail()
    email!: string;
}

export class VerifyOtpDto {
    @IsEmail()
    email!: string;

    @IsString()
    @Length(6, 6)
    otp!: string;
}

export class ResetPasswordDto {
    @IsEmail()
    email!: string;

    @IsString()
    @Length(6, 6)
    otp!: string;

    @IsString()
    @MinLength(6)
    newPassword!: string;
}
