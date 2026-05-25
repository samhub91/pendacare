/**
 * Jest global setup file.
 *
 * This file runs after the test framework is installed in the environment.
 * Use it to configure global mocks, extend Jest matchers, or set up
 * any shared test infrastructure needed across all test suites.
 */

// ---------------------------------------------------------------------------
// Environment variable defaults for tests
// ---------------------------------------------------------------------------
// Provide a deterministic 32-byte (256-bit) AES key so encryption tests
// don't require a real .env.local file.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ??
  Buffer.from('pendacare-test-key-32bytes!!!!!').toString('base64');

// Supabase URL / anon key stubs — real network calls should be mocked at the
// service level; these values prevent "missing env var" errors during import.
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://localhost:54321';

process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'test-anon-key';

process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? 'test-service-role-key';

// ---------------------------------------------------------------------------
// Global mocks
// ---------------------------------------------------------------------------
// Mock the Supabase browser client so unit tests never open real connections.
jest.mock('@/lib/supabase/browser', () => ({
  createSupabaseBrowserClient: jest.fn(() => ({
    auth: {
      getSession: jest.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signInWithPassword: jest.fn(),
      signOut: jest.fn(),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    channel: jest.fn(() => ({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn(),
      unsubscribe: jest.fn(),
    })),
  })),
}));

// Mock the Supabase server client factory — individual tests can override
// specific methods as needed.
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServerClient: jest.fn(() => ({
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: null }, error: null }),
    },
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
  })),
}));

// Mock the Supabase admin client — used by audit log and admin-only operations.
const mockSupabaseAdmin = {
  from: jest.fn(() => ({
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    update: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
  })),
  storage: {
    from: jest.fn(() => ({
      upload: jest.fn().mockResolvedValue({ data: {}, error: null }),
      createSignedUrl: jest.fn().mockResolvedValue({ data: { signedUrl: 'http://test-url.com' }, error: null }),
    })),
  },
};

jest.mock('@/lib/supabase/admin', () => ({
  supabaseAdmin: mockSupabaseAdmin,
  createAdminSupabaseClient: jest.fn(() => mockSupabaseAdmin),
}));
