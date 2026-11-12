import {
    Controller,
    Post,
    Body,
    Get,
    Put,
    Delete,
    UseGuards,
    Request,
    Response as Res,
    Param,
    Query,
} from '@nestjs/common';
import type { Response } from 'express';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    Web3LoginDto,
    ForgotPasswordDto,
    VerifyOtpDto,
    ResetPasswordDto,
    UpdateProfileDto,
    CreateInvitationDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from './entities/user.entity';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    private setAuthCookies(res?: any, accessToken?: string, refreshToken?: string) {
        if (!res || typeof res.cookie !== 'function') return;
        const isProd = process.env.NODE_ENV === 'production';
        if (accessToken) {
            res.cookie('pharma_access_token', accessToken, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'strict',
                path: '/',
                maxAge: 15 * 60 * 1000,
            });
        }
        if (refreshToken) {
            res.cookie('pharma_refresh_token', refreshToken, {
                httpOnly: true,
                secure: isProd,
                sameSite: 'strict',
                path: '/',
                maxAge: 7 * 24 * 60 * 60 * 1000,
            });
        }
    }

    @Get('challenge/:walletAddress')
    getChallenge(@Param('walletAddress') walletAddress: string) {
        return this.authService.generateChallenge(walletAddress);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('register')
    async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res?: any) {
        const result = await this.authService.register(dto);
        this.setAuthCookies(res, result.accessToken, result.refreshToken);
        return result;
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('login')
    async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res?: any) {
        const result = await this.authService.login(dto);
        this.setAuthCookies(res, result.accessToken, result.refreshToken);
        return result;
    }

    @Post('refresh')
    async refreshSession(@Body() body: { userId: number; refreshToken: string }, @Res({ passthrough: true }) res?: any) {
        const result = await this.authService.refreshSession(Number(body?.userId), String(body?.refreshToken || ''));
        this.setAuthCookies(res, result.accessToken, result.refreshToken);
        return result;
    }

    @UseGuards(JwtAuthGuard)
    @Post('revoke-sessions')
    revokeSessions(@Request() req: any, @Res({ passthrough: true }) res?: any) {
        if (res && typeof res.clearCookie === 'function') {
            res.clearCookie('pharma_access_token', { path: '/' });
            res.clearCookie('pharma_refresh_token', { path: '/' });
        }
        const rawId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        return this.authService.revokeAllUserSessions(Number(rawId));
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('web3-login')
    async web3Login(@Body() dto: Web3LoginDto, @Res({ passthrough: true }) res?: any) {
        const result = await this.authService.web3Login(dto);
        this.setAuthCookies(res, result.accessToken, result.refreshToken);
        return result;
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('verify-otp')
    verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.authService.verifyOtp(dto);
    }

    @Throttle({ default: { limit: 5, ttl: 60000 } })
    @Post('reset-password')
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.authService.resetPassword(dto);
    }

    @UseGuards(JwtAuthGuard)
    @Get('profile')
    getProfile(@Request() req: any) {
        const rawId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const userId = rawId ? Number(rawId) : NaN;
        return this.authService.getProfile(userId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.REGULATOR)
    @Get('users')
    getUsers(
        @Query('role') role?: UserRole,
        @Query('limit') limit?: string,
    ) {
        return this.authService.getUsers(role, limit ? Number(limit) : undefined);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.REGULATOR)
    @Get('users/:id')
    getUserById(@Param('id') id: string) {
        return this.authService.getUserById(Number(id));
    }

    @UseGuards(JwtAuthGuard)
    @Put('profile')
    updateProfile(
        @Request() req: any,
        @Body() dto: UpdateProfileDto,
    ) {
        const rawId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const userId = rawId ? Number(rawId) : NaN;
        return this.authService.updateProfile(userId, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Post('users/:id/warn')
    warnUser(
        @Request() req: any,
        @Param('id') id: string,
        @Body() body: { reason?: string },
    ) {
        const rawAdminId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const adminId = rawAdminId ? Number(rawAdminId) : undefined;
        return this.authService.warnUser(Number(id), body?.reason || 'Compliance violation', adminId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Post('users/:id/clear-warnings')
    clearWarnings(
        @Request() req: any,
        @Param('id') id: string,
    ) {
        const rawAdminId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const adminId = rawAdminId ? Number(rawAdminId) : undefined;
        return this.authService.clearWarnings(Number(id), adminId);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Put('users/:id/disable')
    toggleDisableUser(
        @Request() req: any,
        @Param('id') id: string,
        @Body() body: { disabled: boolean; reason?: string },
    ) {
        const rawAdminId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const adminId = rawAdminId ? Number(rawAdminId) : undefined;
        return this.authService.setDisabledStatus(Number(id), body.disabled, adminId, body?.reason);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Delete('users/:id')
    deleteUser(
        @Request() req: any,
        @Param('id') id: string,
    ) {
        const rawAdminId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const adminId = rawAdminId ? Number(rawAdminId) : undefined;
        return this.authService.deleteUser(Number(id), adminId);
    }

    @UseGuards(JwtAuthGuard)
    @Post('logout')
    async logout(@Request() req: any, @Res({ passthrough: true }) res?: any) {
        if (res && typeof res.clearCookie === 'function') {
            res.clearCookie('pharma_access_token', { path: '/' });
            res.clearCookie('pharma_refresh_token', { path: '/' });
        }
        const rawToken = req.headers?.authorization?.slice(7)?.trim();
        const rawId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const userId = rawId ? Number(rawId) : undefined;
        await this.authService.logout(rawToken, userId);
        return { success: true, message: 'Session terminated and token revoked' };
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Post('invitations')
    createInvitation(
        @Request() req: any,
        @Body() dto: CreateInvitationDto,
    ) {
        const rawAdminId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const adminId = rawAdminId ? Number(rawAdminId) : undefined;
        return this.authService.createInvitation(adminId, dto);
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Get('invitations')
    listInvitations() {
        return this.authService.listInvitations();
    }

    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN)
    @Delete('invitations/:id')
    revokeInvitation(
        @Request() req: any,
        @Param('id') id: string,
    ) {
        const rawAdminId = req.user?.userId ?? req.user?.sub ?? req.user?.id;
        const adminId = rawAdminId ? Number(rawAdminId) : undefined;
        return this.authService.revokeInvitation(Number(id), adminId);
    }
}
