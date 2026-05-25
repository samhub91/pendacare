import { z } from 'zod'

export const LeadCareTypeSchema = z.enum(['elderly', 'disability', 'childcare', 'other'])
export type LeadCareType = z.infer<typeof LeadCareTypeSchema>

export const LeadSubmissionSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120, 'Name is too long'),
  email: z.string().trim().email('Enter a valid email address').max(160, 'Email is too long'),
  phone: z.string().trim().max(40, 'Phone is too long').optional(),
  care_type: LeadCareTypeSchema,
  message: z.string().trim().min(10, 'Tell us a little about the support needed').max(2000, 'Message is too long'),
})
