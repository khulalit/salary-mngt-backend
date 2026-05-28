import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;

  const mockAuthService = {
    register: jest.fn(),
    validateUser: jest.fn(),
    login: jest.fn(),
  } as unknown as jest.Mocked<AuthService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(
      AuthService,
    ) as jest.Mocked<AuthService>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should register a user', async () => {
    const dto: RegisterDto = {
      email: 'john@example.com',
      password: 'password',
      role: 'HR_MANAGER',
    };
    const createdUser = {
      id: '1',
      email: 'john@example.com',
      role: 'HR_MANAGER',
    };
    authService.register.mockResolvedValue(createdUser as any);

    const result = await controller.register(dto);

    expect(authService.register).toHaveBeenCalledWith(
      dto.email,
      dto.password,
      dto.role,
    );
    expect(result).toEqual(createdUser);
  });

  it('should return token when login succeeds', async () => {
    const dto: LoginDto = { email: 'john@example.com', password: 'password' };
    const user = {
      id: '1',
      email: 'john@example.com',
      role: 'HR_MANAGER',
    } as any;
    authService.validateUser.mockResolvedValue(user);
    authService.login.mockResolvedValue({ access_token: 'token' } as any);

    const result = await controller.login(dto);

    expect(authService.validateUser).toHaveBeenCalledWith(
      dto.email,
      dto.password,
    );
    expect(authService.login).toHaveBeenCalledWith(user);
    expect(result).toEqual({ access_token: 'token' });
  });

  it('should return 401 object when login fails', async () => {
    const dto: LoginDto = { email: 'john@example.com', password: 'wrong' };
    authService.validateUser.mockResolvedValue(null);

    const result = await controller.login(dto);

    expect(authService.validateUser).toHaveBeenCalledWith(
      dto.email,
      dto.password,
    );
    expect(result).toEqual({ statusCode: 401, message: 'Invalid credentials' });
  });

  it('should return user profile from request', () => {
    const request = {
      user: { id: '1', email: 'john@example.com', role: 'HR_MANAGER' },
    };

    const result = controller.profile(request as any);

    expect(result).toEqual(request.user);
  });

  it('should return user profile from /me request', () => {
    const request = {
      user: { id: '1', email: 'john@example.com', role: 'HR_MANAGER' },
    };

    const result = controller.me(request as any);

    expect(result).toEqual(request.user);
  });
});
