import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { CreateUserDto, LoginDto } from './dto/login.dto';
import { User } from '../../entities/users.entity';
import { GoogleGenAI } from '@google/genai';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

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

  async generateAIResponse(prompt: string): Promise<any> {
    this.logger.log(
      `Generating AI response for prompt length: ${prompt?.length ?? 0}`,
    );

    try {
      const result = await this.ai.models.generateContent({
        model: 'models/gemini-2.5-flash',
        contents: prompt,
      });
      this.logger.log('AI response generated successfully');
      return result;
    } catch (err) {
      this.logger.error(
        'Failed to generate AI response',
        err instanceof Error ? err.stack : String(err),
      );
      throw err;
    }
  }
}
