import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';

export interface JwtPayload {
  sub: string;
  email: string;
  type: 'access' | 'refresh';
}

export interface AuthUser {
  id: string;
  email: string;
  phone: string;
  firstName: string;
  lastName: string;
  status: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
    private auditService: AuditService,
  ) {}

  async register(dto: RegisterDto, ip?: string): Promise<{ user: AuthUser; tokens: { accessToken: string; refreshToken: string } }> {
    // Check if user exists
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email }, { phone: dto.phone }],
        deletedAt: null,
      },
    });

    if (existingUser) {
      throw new ConflictException('User with this email or phone already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(dto.password, 12);

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email: dto.email.toLowerCase(),
        phone: dto.phone,
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        idNumber: dto.idNumber,
      },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Create session
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken, dto.deviceInfo, ip);

    // Audit log
    await this.auditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'USER_REGISTERED',
      resourceType: 'USER',
      resourceId: user.id,
      outcome: 'SUCCESS',
      ipAddress: ip,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
      tokens,
    };
  }

  async login(dto: LoginDto, ip?: string): Promise<{ user: AuthUser; tokens: { accessToken: string; refreshToken: string } }> {
    // Find user
    const user = await this.prisma.user.findFirst({
      where: {
        OR: [{ email: dto.email?.toLowerCase() }, { phone: dto.phone }],
        deletedAt: null,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!isPasswordValid) {
      await this.auditService.log({
        actorId: user.id,
        actorType: 'USER',
        action: 'LOGIN_FAILED',
        resourceType: 'USER',
        resourceId: user.id,
        outcome: 'FAILURE',
        errorCode: 'INVALID_PASSWORD',
        ipAddress: ip,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    // Generate tokens
    const tokens = await this.generateTokens(user.id, user.email);

    // Create session
    await this.createSession(user.id, tokens.accessToken, tokens.refreshToken, dto.deviceInfo, ip);

    // Audit log
    await this.auditService.log({
      actorId: user.id,
      actorType: 'USER',
      action: 'USER_LOGIN',
      resourceType: 'SESSION',
      outcome: 'SUCCESS',
      ipAddress: ip,
    });

    return {
      user: {
        id: user.id,
        email: user.email,
        phone: user.phone,
        firstName: user.firstName,
        lastName: user.lastName,
        status: user.status,
      },
      tokens,
    };
  }

  async refreshTokens(dto: RefreshTokenDto, ip?: string): Promise<{ accessToken: string; refreshToken: string }> {
    // Verify refresh token
    let payload: JwtPayload;
    try {
      payload = this.jwtService.verify(dto.refreshToken, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Invalid token type');
    }

    // Find session
    const session = await this.prisma.session.findFirst({
      where: {
        refreshToken: dto.refreshToken,
        revokedAt: null,
      },
      include: { user: true },
    });

    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired or invalid');
    }

    // Revoke old session
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });

    // Generate new tokens
    const tokens = await this.generateTokens(session.userId, session.user.email);

    // Create new session
    await this.createSession(session.userId, tokens.accessToken, tokens.refreshToken, session.deviceInfo, ip);

    return tokens;
  }

  async logout(userId: string, token: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: {
        userId,
        token,
        revokedAt: null,
      },
      data: { revokedAt: new Date() },
    });

    await this.auditService.log({
      actorId: userId,
      actorType: 'USER',
      action: 'USER_LOGOUT',
      resourceType: 'SESSION',
      outcome: 'SUCCESS',
    });
  }

  async validateUser(userId: string): Promise<AuthUser | null> {
    const user = await this.prisma.user.findFirst({
      where: {
        id: userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
    });

    if (!user) return null;

    return {
      id: user.id,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      status: user.status,
    };
  }

  async getUserGroupRoles(userId: string): Promise<Map<string, string>> {
    const memberships = await this.prisma.groupMember.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: {
        groupId: true,
        role: true,
      },
    });

    const roleMap = new Map<string, string>();
    memberships.forEach((m) => roleMap.set(m.groupId, m.role));
    return roleMap;
  }

  private async generateTokens(userId: string, email: string): Promise<{ accessToken: string; refreshToken: string }> {
    const accessPayload: JwtPayload = { sub: userId, email, type: 'access' };
    const refreshPayload: JwtPayload = { sub: userId, email, type: 'refresh' };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(accessPayload, {
        secret: this.configService.get('JWT_SECRET'),
        expiresIn: this.configService.get('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(refreshPayload, {
        secret: this.configService.get('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d'),
      }),
    ]);

    return { accessToken, refreshToken };
  }

  private async createSession(
    userId: string,
    token: string,
    refreshToken: string,
    deviceInfo?: string,
    ipAddress?: string,
  ): Promise<void> {
    const expiresIn = this.configService.get('JWT_REFRESH_EXPIRES_IN', '7d');
    const expiresAt = new Date();
    
    // Parse expiry (simple parsing for d/h/m)
    const match = expiresIn.match(/^(\d+)([dhm])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      if (unit === 'd') expiresAt.setDate(expiresAt.getDate() + value);
      else if (unit === 'h') expiresAt.setHours(expiresAt.getHours() + value);
      else if (unit === 'm') expiresAt.setMinutes(expiresAt.getMinutes() + value);
    } else {
      expiresAt.setDate(expiresAt.getDate() + 7); // Default 7 days
    }

    await this.prisma.session.create({
      data: {
        userId,
        token,
        refreshToken,
        deviceInfo,
        ipAddress,
        expiresAt,
      },
    });
  }
}
