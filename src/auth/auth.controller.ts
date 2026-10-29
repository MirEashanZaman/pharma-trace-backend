import {
    Controller,
    Post,
    Body,
    Get,
    Put,
    Delete,
    UseGuards,
    Request,
    Param,
    Query,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    Web3LoginDto,
    ForgotPasswordDto,
    VerifyOtpDto,
    ResetPasswordDto,
    UpdateProfileDto,
} from './dto/auth.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { RolesGuard } from './roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from './entities/user.entity';

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Get('challenge/:walletAddress')
    getChallenge(@Param('walletAddress') walletAddress: string) {
        return this.authService.generateChallenge(walletAddress);
    }

    @Post('register')
    register(@Body() dto: RegisterDto) {
        return this.authService.register(dto);
    }

    @Post('login')
    login(@Body() dto: LoginDto) {
        return this.authService.login(dto);
    }

    @Post('web3-login')
    web3Login(@Body() dto: Web3LoginDto) {
        return this.authService.web3Login(dto);
    }

    @Post('forgot-password')
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.authService.forgotPassword(dto);
    }

    @Post('verify-otp')
    verifyOtp(@Body() dto: VerifyOtpDto) {
        return this.authService.verifyOtp(dto);
    }

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
}
