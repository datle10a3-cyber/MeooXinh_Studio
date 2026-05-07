import { z } from "zod";

export const registerSchema = z.object({
  studioName: z.string().min(2, "Ten studio phai co it nhat 2 ky tu."),
  name: z.string().min(2, "Ten nguoi dung phai co it nhat 2 ky tu."),
  email: z.string().email("Email khong hop le.").trim().toLowerCase(),
  password: z.string().min(10, "Mat khau can it nhat 10 ky tu."),
  otp: z.union([z.string().regex(/^\d{6}$/, "Ma OTP phai gom 6 chu so."), z.literal("")]).optional(),
  inviteCode: z.string().optional(),
});

export const registerOtpSchema = z.object({
  email: z.string().email("Email khong hop le.").trim().toLowerCase(),
});

export const loginSchema = z.object({
  email: z.string().email("Email khong hop le.").trim().toLowerCase(),
  password: z.string().min(1, "Vui long nhap mat khau."),
});

export const resourcePayloadSchema = z.record(z.string(), z.unknown());
