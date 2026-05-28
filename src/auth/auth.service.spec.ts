import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';

import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';

jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

describe('AuthService', () => {
  let service: AuthService;

  const mockUsersService = {
    findByEmail: jest.fn(),
    create: jest.fn(),
  };

  const mockJwtService = {
    sign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
        {
          provide: JwtService,
          useValue: mockJwtService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should validate a user with correct credentials', async () => {
    const user = {
      id: '1',
      email: 'test@example.com',
      passwordHash: 'hash',
      role: 'HR_MANAGER',
    };

    mockUsersService.findByEmail.mockResolvedValue(user);

    (bcrypt.compare as jest.Mock).mockResolvedValue(true);

    const result = await service.validateUser('test@example.com', 'password');

    expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
      'test@example.com',
    );

    expect(bcrypt.compare).toHaveBeenCalledWith('password', 'hash');

    expect(result).toEqual({
      id: '1',
      email: 'test@example.com',
      role: 'HR_MANAGER',
    });
  });

  it('should return null when user is not found', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);

    const result = await service.validateUser(
      'missing@example.com',
      'password',
    );

    expect(result).toBeNull();

    expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
      'missing@example.com',
    );

    expect(bcrypt.compare).not.toHaveBeenCalled();
  });

  it('should return null when password is invalid', async () => {
    const user = {
      id: '1',
      email: 'test@example.com',
      passwordHash: 'hash',
      role: 'HR_MANAGER',
    };

    mockUsersService.findByEmail.mockResolvedValue(user);

    (bcrypt.compare as jest.Mock).mockResolvedValue(false);

    const result = await service.validateUser(
      'test@example.com',
      'wrong-password',
    );

    expect(result).toBeNull();

    expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
      'test@example.com',
    );

    expect(bcrypt.compare).toHaveBeenCalledWith('wrong-password', 'hash');
  });

  it('should sign a JWT token on login', async () => {
    const user = {
      id: '1',
      email: 'test@example.com',
      role: 'HR_MANAGER',
    };

    mockJwtService.sign.mockReturnValue('signed-token');

    const result = await service.login(user as any);

    expect(mockJwtService.sign).toHaveBeenCalledWith({
      sub: '1',
      email: 'test@example.com',
      role: 'HR_MANAGER',
    });

    expect(result).toEqual({
      access_token: 'signed-token',
    });
  });

  it('should register a new user successfully', async () => {
    mockUsersService.findByEmail.mockResolvedValue(null);

    (bcrypt.hash as jest.Mock).mockResolvedValue('hashed-password');

    mockUsersService.create.mockResolvedValue({
      id: '1',
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      role: 'HR_ASSISTANT',
    });

    const result = await service.register(
      'new@example.com',
      'password',
      'HR_ASSISTANT',
    );

    expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
      'new@example.com',
    );

    expect(bcrypt.hash).toHaveBeenCalledWith('password', 10);

    expect(mockUsersService.create).toHaveBeenCalledWith({
      email: 'new@example.com',
      passwordHash: 'hashed-password',
      role: 'HR_ASSISTANT',
    });

    expect(result).toEqual({
      id: '1',
      email: 'new@example.com',
      role: 'HR_ASSISTANT',
    });
  });

  it('should throw on duplicate registration', async () => {
    mockUsersService.findByEmail.mockResolvedValue({
      id: '1',
      email: 'existing@example.com',
    });

    await expect(
      service.register('existing@example.com', 'password'),
    ).rejects.toThrow(BadRequestException);

    expect(mockUsersService.findByEmail).toHaveBeenCalledWith(
      'existing@example.com',
    );
  });
});
