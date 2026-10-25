import { verifyAuthSession } from '../../../lib/auth.js';

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const session = verifyAuthSession(token);
  return Response.json({ session });
}

export async function POST(request: Request) {
  const body = await request.json();
  return Response.json({ status: 'authenticated', user: body.email });
}
