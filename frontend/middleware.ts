import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

// API routes that don't need auth (public endpoints)
const isPublicRoute = createRouteMatcher([
  '/',
  '/login(.*)',
  '/signup(.*)',
  '/api/leaderboard(.*)',
  '/api/seasons(.*)',
  '/api/players/(.*)/elo-history',
  '/api/badges',
  '/api/matches',          // GET list is public
]);

export default clerkMiddleware(async (auth, request) => {
  if (!isPublicRoute(request)) {
    await auth.protect();
  }
});

export const config = {
  matcher: ['/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)', '/(api|trpc)(.*)'],
};
