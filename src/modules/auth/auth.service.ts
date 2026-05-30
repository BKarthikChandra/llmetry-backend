import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, LoginDto, ResetPasswordDto } from './dto/login.dto';
import { User } from '../../entities/users.entity';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<{ access_token: string }> {
    this.logger.log(`Login attempt for email: ${loginDto.email}`);

    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email: loginDto.email })
      .getOne();

    if (!user) {
      this.logger.warn(
        `Login failed — no account found for email: ${loginDto.email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      loginDto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      this.logger.warn(
        `Login failed — incorrect password for email: ${loginDto.email}`,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Login successful for user ${user.id} (${user.email})`);
    const payload = { sub: user.id, email: user.email };
    return { access_token: this.jwtService.sign(payload) };
  }

  async createUser(createUserDto: CreateUserDto): Promise<User> {
    this.logger.log(`Creating new user with email: ${createUserDto.email}`);

    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);
    const user = this.userRepository.create({
      email: createUserDto.email,
      passwordHash: hashedPassword,
    });
    const saved = await this.userRepository.save(user);

    this.logger.log(`User created successfully with id: ${saved.id}`);
    return saved;
  }

  async resetPassword(
    userId: number,
    resetPasswordDto: ResetPasswordDto,
  ): Promise<void> {
    this.logger.log(`Resetting password for user with ID: ${userId}`);
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.id = :id', { id: userId })
      .getOne();
    if(!user) {
      this.logger.warn(`Password reset failed — user not found with ID: ${userId}`);
      throw new UnauthorizedException('User not found');
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      resetPasswordDto.currentPassword,
      user.passwordHash,
    );
    
    if (!isCurrentPasswordValid) {
      this.logger.warn(`Password reset failed — incorrect current password for user ID: ${userId}`);
      throw new UnauthorizedException('Invalid current password');
    }

    const newHashedPassword = await bcrypt.hash(resetPasswordDto.newPassword, 10);
    user.passwordHash = newHashedPassword;
    user.updatedOn = new Date();
    await this.userRepository.save(user);
    this.logger.log(`Password reset successful for user ID: ${userId}`);
  }
}
