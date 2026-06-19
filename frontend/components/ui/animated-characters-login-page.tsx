"use client";
import { useState, useEffect, useRef } from "react";
import { useSignIn } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// ─── Pupil (no white sclera) ──────────────────────────────────────────────────
interface PupilProps {
  size?: number;
  maxDistance?: number;
  pupilColor?: string;
  forceLookX?: number;
  forceLookY?: number;
}
const Pupil = ({ size = 12, maxDistance = 5, pupilColor = "#0a0a0a", forceLookX, forceLookY }: PupilProps) => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);
  const pos = (() => {
    if (!ref.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = ref.current.getBoundingClientRect();
    const dx = mouse.x - (r.left + r.width / 2);
    const dy = mouse.y - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  })();
  return (
    <div ref={ref} className="rounded-full"
      style={{ width: size, height: size, backgroundColor: pupilColor,
        transform: `translate(${pos.x}px, ${pos.y}px)`, transition: "transform 0.1s ease-out" }} />
  );
};

// ─── EyeBall ──────────────────────────────────────────────────────────────────
interface EyeBallProps {
  size?: number; pupilSize?: number; maxDistance?: number;
  eyeColor?: string; pupilColor?: string; isBlinking?: boolean;
  forceLookX?: number; forceLookY?: number;
}
const EyeBall = ({ size = 48, pupilSize = 16, maxDistance = 10, eyeColor = "white",
  pupilColor = "#0a0a0a", isBlinking = false, forceLookX, forceLookY }: EyeBallProps) => {
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);
  const pos = (() => {
    if (!ref.current) return { x: 0, y: 0 };
    if (forceLookX !== undefined && forceLookY !== undefined) return { x: forceLookX, y: forceLookY };
    const r = ref.current.getBoundingClientRect();
    const dx = mouse.x - (r.left + r.width / 2);
    const dy = mouse.y - (r.top + r.height / 2);
    const dist = Math.min(Math.sqrt(dx ** 2 + dy ** 2), maxDistance);
    const angle = Math.atan2(dy, dx);
    return { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist };
  })();
  return (
    <div ref={ref} className="rounded-full flex items-center justify-center transition-all duration-150"
      style={{ width: size, height: isBlinking ? 2 : size, backgroundColor: eyeColor, overflow: "hidden" }}>
      {!isBlinking && (
        <div className="rounded-full"
          style={{ width: pupilSize, height: pupilSize, backgroundColor: pupilColor,
            transform: `translate(${pos.x}px, ${pos.y}px)`, transition: "transform 0.1s ease-out" }} />
      )}
    </div>
  );
};

// ─── Login Page ───────────────────────────────────────────────────────────────
function LoginPage() {
  const { isLoaded, signIn, setActive } = useSignIn();
  const { isSignedIn } = useAuth();
  const router = useRouter();

  // Already logged in — go to dashboard
  useEffect(() => {
    if (isSignedIn) router.replace("/dashboard");
  }, [isSignedIn, router]);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking, setIsBlackBlinking] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isLookingAtEachOther, setIsLookingAtEachOther] = useState(false);
  const [isPurplePeeking, setIsPurplePeeking] = useState(false);

  // Forgot password flow
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetStep, setResetStep] = useState<"request" | "verify">("request");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [resetError, setResetError] = useState("");
  const [resetLoading, setResetLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef  = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const h = (e: MouseEvent) => { setMouseX(e.clientX); setMouseY(e.clientY); };
    window.addEventListener("mousemove", h);
    return () => window.removeEventListener("mousemove", h);
  }, []);

  // Random blinking
  useEffect(() => {
    const blink = (setter: (v: boolean) => void) => {
      const t = setTimeout(() => {
        setter(true);
        setTimeout(() => { setter(false); blink(setter); }, 150);
      }, Math.random() * 4000 + 3000);
      return t;
    };
    const t1 = blink(setIsPurpleBlinking);
    const t2 = blink(setIsBlackBlinking);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  // Look at each other when typing starts
  useEffect(() => {
    if (!isTyping) { setIsLookingAtEachOther(false); return; }
    setIsLookingAtEachOther(true);
    const t = setTimeout(() => setIsLookingAtEachOther(false), 800);
    return () => clearTimeout(t);
  }, [isTyping]);

  // Purple peeks when password visible
  useEffect(() => {
    if (!password.length || !showPassword) { setIsPurplePeeking(false); return; }
    const t = setTimeout(() => {
      setIsPurplePeeking(true);
      setTimeout(() => setIsPurplePeeking(false), 800);
    }, Math.random() * 3000 + 2000);
    return () => clearTimeout(t);
  }, [password, showPassword, isPurplePeeking]);

  const calcPos = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 3;
    return {
      faceX: Math.max(-15, Math.min(15, (mouseX - cx) / 20)),
      faceY: Math.max(-10, Math.min(10, (mouseY - cy) / 30)),
      bodySkew: Math.max(-6, Math.min(6, -(mouseX - cx) / 120)),
    };
  };
  const pp = calcPos(purpleRef);
  const bp = calcPos(blackRef);
  const yp = calcPos(yellowRef);
  const op = calcPos(orangeRef);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await signIn.create({
        identifier: email,
        password,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/dashboard");
      } else {
        // eslint-disable-next-line no-console
        console.warn("Clerk sign-in did not complete:", result);
        setError(`Sign-in needs an extra step (status: ${result.status}). Check the browser console for details.`);
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string; code?: string }[] };
      // eslint-disable-next-line no-console
      console.warn("Clerk sign-in error:", clerkError);
      setError(clerkError.errors?.[0]?.message ?? "Something went wrong. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const openForgotPassword = () => {
    setResetEmail(email);
    setResetCode("");
    setNewPassword("");
    setResetError("");
    setResetStep("request");
    setShowForgotPassword(true);
  };

  const handleRequestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setResetError("");
    setResetLoading(true);
    try {
      await signIn.create({
        identifier: resetEmail,
        strategy: "reset_password_email_code",
      });
      setResetStep("verify");
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      // eslint-disable-next-line no-console
      console.warn("Clerk reset-password request error:", clerkError);
      setResetError(clerkError.errors?.[0]?.message ?? "Could not send reset email. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleConfirmReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setResetError("");
    setResetLoading(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: "reset_password_email_code",
        code: resetCode,
        password: newPassword,
      });
      if (result.status === "complete") {
        await setActive({ session: result.createdSessionId });
        router.push("/dashboard");
      } else {
        // eslint-disable-next-line no-console
        console.warn("Clerk reset-password did not complete:", result);
        setResetError(`Could not finish reset (status: ${result.status}). Check the code and try again.`);
      }
    } catch (err: unknown) {
      const clerkError = err as { errors?: { message: string }[] };
      // eslint-disable-next-line no-console
      console.warn("Clerk reset-password confirm error:", clerkError);
      setResetError(clerkError.errors?.[0]?.message ?? "Could not reset password. Please try again.");
    } finally {
      setResetLoading(false);
    }
  };

  const handleGoogleSignIn = () => {
    if (!isLoaded) return;
    signIn.authenticateWithRedirect({
      strategy: "oauth_google",
      redirectUrl: "/sso-callback",
      redirectUrlComplete: "/dashboard",
    });
  };

  const hidingPassword = password.length > 0 && !showPassword;
  const showingPassword = password.length > 0 && showPassword;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left panel ── */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden"
        style={{ backgroundColor: "#0a0a0a" }}>

        {/* Gold glow blobs */}
        <div className="absolute top-[-10%] left-[-20%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle farthest-side, #FFB81C, transparent)" }} />
        <div className="absolute bottom-[-10%] right-[-20%] w-[500px] h-[500px] rounded-full opacity-10"
          style={{ background: "radial-gradient(circle farthest-side, #FFB81C, transparent)" }} />
        <div className="absolute inset-0" style={{
          backgroundImage: "linear-gradient(rgba(255,184,28,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,184,28,0.04) 1px, transparent 1px)",
          backgroundSize: "24px 24px"
        }} />

        {/* Logo */}
        <Link href="/" className="relative z-10 flex items-center gap-3 hover:opacity-80 transition-opacity">
          <Image src="/logo.svg" alt="OU Roundnet" width={40} height={40} />
          <span className="text-base font-semibold tracking-wide">
            OU <span style={{ color: "#FFB81C" }}>Roundnet</span>
          </span>
        </Link>

        {/* Characters */}
        <div className="relative z-10 flex items-end justify-center h-[440px]">
          <div className="relative" style={{ width: 550, height: 420 }}>

            {/* Purple — back */}
            <div ref={purpleRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: 70, width: 180,
                height: (isTyping || hidingPassword) ? 440 : 400,
                backgroundColor: "#6C3FF5",
                borderRadius: "10px 10px 0 0", zIndex: 1,
                transform: showingPassword
                  ? "skewX(0deg)"
                  : (isTyping || hidingPassword)
                    ? `skewX(${(pp.bodySkew || 0) - 12}deg) translateX(40px)`
                    : `skewX(${pp.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}>
              <div className="absolute flex gap-8 transition-all duration-700 ease-in-out"
                style={{
                  left: showingPassword ? 20 : isLookingAtEachOther ? 55 : 45 + pp.faceX,
                  top:  showingPassword ? 35 : isLookingAtEachOther ? 65 : 40 + pp.faceY,
                }}>
                <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#0a0a0a"
                  isBlinking={isPurpleBlinking}
                  forceLookX={showingPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={showingPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined} />
                <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#0a0a0a"
                  isBlinking={isPurpleBlinking}
                  forceLookX={showingPassword ? (isPurplePeeking ? 4 : -4) : isLookingAtEachOther ? 3 : undefined}
                  forceLookY={showingPassword ? (isPurplePeeking ? 5 : -4) : isLookingAtEachOther ? 4 : undefined} />
              </div>
            </div>

            {/* Black — middle */}
            <div ref={blackRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: 240, width: 120, height: 310,
                backgroundColor: "#2a2a2a",
                border: "2px solid #FFB81C",
                borderRadius: "8px 8px 0 0", zIndex: 2,
                transform: showingPassword
                  ? "skewX(0deg)"
                  : isLookingAtEachOther
                    ? `skewX(${(bp.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                    : `skewX(${bp.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}>
              <div className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{
                  left: showingPassword ? 10 : isLookingAtEachOther ? 32 : 26 + bp.faceX,
                  top:  showingPassword ? 28 : isLookingAtEachOther ? 12 : 32 + bp.faceY,
                }}>
                <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#0a0a0a"
                  isBlinking={isBlackBlinking}
                  forceLookX={showingPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={showingPassword ? -4 : isLookingAtEachOther ? -4 : undefined} />
                <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#0a0a0a"
                  isBlinking={isBlackBlinking}
                  forceLookX={showingPassword ? -4 : isLookingAtEachOther ? 0 : undefined}
                  forceLookY={showingPassword ? -4 : isLookingAtEachOther ? -4 : undefined} />
              </div>
            </div>

            {/* Orange — front left */}
            <div ref={orangeRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: 0, width: 240, height: 200,
                backgroundColor: "#FFB81C",
                borderRadius: "120px 120px 0 0", zIndex: 3,
                transform: showingPassword ? "skewX(0deg)" : `skewX(${op.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}>
              <div className="absolute flex gap-8 transition-all duration-200 ease-out"
                style={{
                  left: showingPassword ? 50 : 82 + (op.faceX || 0),
                  top:  showingPassword ? 85 : 90 + (op.faceY || 0),
                }}>
                <Pupil size={12} maxDistance={5} pupilColor="#0a0a0a"
                  forceLookX={showingPassword ? -5 : undefined}
                  forceLookY={showingPassword ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#0a0a0a"
                  forceLookX={showingPassword ? -5 : undefined}
                  forceLookY={showingPassword ? -4 : undefined} />
              </div>
            </div>

            {/* Yellow — front right */}
            <div ref={yellowRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: 310, width: 140, height: 230,
                backgroundColor: "#E8D754",
                borderRadius: "70px 70px 0 0", zIndex: 4,
                transform: showingPassword ? "skewX(0deg)" : `skewX(${yp.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}>
              <div className="absolute flex gap-6 transition-all duration-200 ease-out"
                style={{
                  left: showingPassword ? 20 : 52 + (yp.faceX || 0),
                  top:  showingPassword ? 35 : 40 + (yp.faceY || 0),
                }}>
                <Pupil size={12} maxDistance={5} pupilColor="#0a0a0a"
                  forceLookX={showingPassword ? -5 : undefined}
                  forceLookY={showingPassword ? -4 : undefined} />
                <Pupil size={12} maxDistance={5} pupilColor="#0a0a0a"
                  forceLookX={showingPassword ? -5 : undefined}
                  forceLookY={showingPassword ? -4 : undefined} />
              </div>
              <div className="absolute w-20 h-1 rounded-full transition-all duration-200 ease-out"
                style={{
                  backgroundColor: "#0a0a0a",
                  left: showingPassword ? 10 : 40 + (yp.faceX || 0),
                  top:  showingPassword ? 88 : 88 + (yp.faceY || 0),
                }} />
            </div>
          </div>
        </div>

        {/* Footer links */}
        <div className="relative z-10 flex items-center gap-8 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Contact</a>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[420px]">

          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center justify-center gap-3 mb-12 hover:opacity-80 transition-opacity">
            <Image src="/logo.svg" alt="OU Roundnet" width={36} height={36} />
            <span className="font-semibold text-gray-900">OU <span style={{ color: "#FFB81C" }}>Roundnet</span></span>
          </Link>

          {/* Header */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">Welcome back!</h1>
            <p className="text-gray-500 text-sm">Sign in to view your ranking and stats</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
              <Input id="email" type="email" placeholder="you@oakland.edu"
                value={email} autoComplete="off"
                onChange={e => setEmail(e.target.value)}
                onFocus={() => setIsTyping(true)}
                onBlur={() => setIsTyping(false)}
                required
                className="h-12 border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
              <div className="relative">
                <Input id="password" type={showPassword ? "text" : "password"}
                  placeholder="••••••••" value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  className="h-12 pr-10 border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]" />
                <button type="button" onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox id="remember" />
                <Label htmlFor="remember" className="text-sm font-normal cursor-pointer text-gray-600">
                  Remember me
                </Label>
              </div>
              <button type="button" onClick={openForgotPassword}
                className="text-sm font-medium hover:underline" style={{ color: "#FFB81C" }}>
                Forgot password?
              </button>
            </div>

            {error && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={isLoading}
              className="w-full h-12 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
              style={{ backgroundColor: "#FFB81C", color: "#0a0a0a" }}>
              {isLoading ? "Signing in..." : "Log in"}
            </button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Google */}
          <Button variant="outline" className="w-full h-12 border-gray-200 hover:bg-gray-50 text-gray-700" type="button" onClick={handleGoogleSignIn}>
            <svg className="mr-2 w-5 h-5" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </Button>

          {/* Sign up */}
          <p className="text-center text-sm text-gray-500 mt-8">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-semibold hover:underline" style={{ color: "#FFB81C" }}>
              Sign up
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot password modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-[400px] rounded-xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">
                {resetStep === "request" ? "Reset your password" : "Enter code & new password"}
              </h2>
              <button type="button" onClick={() => setShowForgotPassword(false)}
                className="text-gray-400 hover:text-gray-700 text-sm">
                ✕
              </button>
            </div>

            {resetStep === "request" ? (
              <form onSubmit={handleRequestReset} className="space-y-4">
                <p className="text-sm text-gray-500">
                  Enter your account email. We&apos;ll send you a code to reset your password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-medium text-gray-700">Email</Label>
                  <Input id="reset-email" type="email" placeholder="you@oakland.edu"
                    value={resetEmail} autoComplete="off"
                    onChange={e => setResetEmail(e.target.value)}
                    required className="h-11 border-gray-200" />
                </div>
                {resetError && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    {resetError}
                  </div>
                )}
                <button type="submit" disabled={resetLoading}
                  className="w-full h-11 rounded-lg font-semibold text-sm disabled:opacity-60"
                  style={{ backgroundColor: "#FFB81C", color: "#0a0a0a" }}>
                  {resetLoading ? "Sending..." : "Send reset code"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleConfirmReset} className="space-y-4">
                <p className="text-sm text-gray-500">
                  Check <span className="font-medium text-gray-700">{resetEmail}</span> for a 6-digit code, then set a new password.
                </p>
                <div className="space-y-2">
                  <Label htmlFor="reset-code" className="text-sm font-medium text-gray-700">Code</Label>
                  <Input id="reset-code" type="text" placeholder="123456"
                    value={resetCode} name="otp"
                    autoComplete="one-time-code" inputMode="numeric"
                    onChange={e => setResetCode(e.target.value)}
                    required className="h-11 border-gray-200" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium text-gray-700">New password</Label>
                  <div className="relative">
                    <Input id="new-password" type={showNewPassword ? "text" : "password"} placeholder="••••••••"
                      value={newPassword} autoComplete="new-password"
                      onChange={e => setNewPassword(e.target.value)}
                      required minLength={8} className="h-11 pr-10 border-gray-200" />
                    <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
                      {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                  </div>
                </div>
                {resetError && (
                  <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">
                    {resetError}
                  </div>
                )}
                <button type="submit" disabled={resetLoading}
                  className="w-full h-11 rounded-lg font-semibold text-sm disabled:opacity-60"
                  style={{ backgroundColor: "#FFB81C", color: "#0a0a0a" }}>
                  {resetLoading ? "Resetting..." : "Reset password"}
                </button>
                <button type="button" onClick={() => setResetStep("request")}
                  className="w-full text-center text-sm text-gray-500 hover:underline">
                  Didn&apos;t get a code? Send again
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export const Component = LoginPage;
