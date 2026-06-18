"use client";
import { useState, useEffect, useRef } from "react";
import { useSignUp } from "@clerk/nextjs/legacy";
import { useAuth } from "@clerk/nextjs";
import { apiFetch } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

// ─── Pupil ────────────────────────────────────────────────────────────────────
interface PupilProps {
  size?: number; maxDistance?: number; pupilColor?: string;
  forceLookX?: number; forceLookY?: number;
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
    const dx = mouse.x - (r.left + r.width / 2), dy = mouse.y - (r.top + r.height / 2);
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
    const dx = mouse.x - (r.left + r.width / 2), dy = mouse.y - (r.top + r.height / 2);
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

// ─── Signup Page ──────────────────────────────────────────────────────────────
function SignupPage() {
  const { isLoaded, signUp, setActive } = useSignUp();
  const { getToken } = useAuth();
  const router = useRouter();

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm]   = useState(false);
  const [form, setForm] = useState({
    firstName: "", lastName: "", email: "", age: "", gender: "", password: "", confirm: "",
  });
  const [verifying,  setVerifying]  = useState(false);
  const [code,       setCode]       = useState("");
  const [error,      setError]      = useState("");
  const [isLoading,  setIsLoading]  = useState(false);

  // Character animation state
  const [isPurpleBlinking, setIsPurpleBlinking] = useState(false);
  const [isBlackBlinking,  setIsBlackBlinking]  = useState(false);
  const [isTyping,         setIsTyping]         = useState(false);
  const [isPurplePeeking,  setIsPurplePeeking]  = useState(false);

  const purpleRef = useRef<HTMLDivElement>(null);
  const blackRef  = useRef<HTMLDivElement>(null);
  const yellowRef = useRef<HTMLDivElement>(null);
  const orangeRef = useRef<HTMLDivElement>(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const h = (e: MouseEvent) => setMouse({ x: e.clientX, y: e.clientY });
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

  // Peek when password visible
  useEffect(() => {
    if (!form.password || !showPassword) { setIsPurplePeeking(false); return; }
    const t = setTimeout(() => {
      setIsPurplePeeking(true);
      setTimeout(() => setIsPurplePeeking(false), 800);
    }, Math.random() * 3000 + 2000);
    return () => clearTimeout(t);
  }, [form.password, showPassword, isPurplePeeking]);

  const calcPos = (ref: React.RefObject<HTMLDivElement | null>) => {
    if (!ref.current) return { faceX: 0, faceY: 0, bodySkew: 0 };
    const r = ref.current.getBoundingClientRect();
    const cx = r.left + r.width / 2, cy = r.top + r.height / 3;
    return {
      faceX:    Math.max(-15, Math.min(15, (mouse.x - cx) / 20)),
      faceY:    Math.max(-10, Math.min(10, (mouse.y - cy) / 30)),
      bodySkew: Math.max(-6,  Math.min(6,  -(mouse.x - cx) / 120)),
    };
  };
  const pp = calcPos(purpleRef), bp = calcPos(blackRef);
  const yp = calcPos(yellowRef), op = calcPos(orangeRef);

  const hidingPassword = (form.password.length > 0 || form.confirm.length > 0) && (!showPassword && !showConfirm);
  const showingPassword = (form.password.length > 0 || form.confirm.length > 0) && (showPassword || showConfirm);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }));

  // Step 1 — create Clerk user + trigger email OTP
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    if (form.password !== form.confirm) { setError("Passwords don't match."); return; }
    if (Number(form.age) < 16 || Number(form.age) > 99) { setError("Please enter a valid age (16–99)."); return; }
    setIsLoading(true);
    try {
      await signUp.create({
        firstName: form.firstName,
        lastName: form.lastName,
        emailAddress: form.email,
        password: form.password,
        unsafeMetadata: { age: Number(form.age), gender: form.gender },
      });
      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
      setVerifying(true);
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Sign up failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2 — verify OTP, create Supabase player row, redirect
  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isLoaded) return;
    setError("");
    setIsLoading(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code });
      if (result.status === "complete") {
        // Activate the session FIRST — /api/players requires an authenticated
        // request, and the auth cookie isn't set until setActive resolves.
        await setActive({ session: result.createdSessionId });

        // Create player record in Supabase (status: pending, awaiting admin approval)
        const token = await getToken();
        const playerRes = await apiFetch("/api/players", {
          method: "POST",
          body: JSON.stringify({
            firstName: form.firstName,
            lastName: form.lastName,
            email: form.email,
            age: Number(form.age),
            gender: form.gender,
          }),
        }, token);
        if (!playerRes.ok) {
          const data = await playerRes.json().catch(() => ({}));
          console.error("Failed to create player record:", data.error);
        }

        router.push("/dashboard");
      } else {
        setError("Verification incomplete. Please try again.");
      }
    } catch (err: any) {
      setError(err.errors?.[0]?.longMessage ?? err.errors?.[0]?.message ?? "Invalid code.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* ── Left panel ── */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden"
        style={{ backgroundColor: "#0a0a0a" }}>

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

            {/* Purple */}
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
                  left: showingPassword ? 20 : isTyping ? 55 : 45 + pp.faceX,
                  top:  showingPassword ? 35 : isTyping ? 65 : 40 + pp.faceY,
                }}>
                <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#0a0a0a"
                  isBlinking={isPurpleBlinking}
                  forceLookX={showingPassword ? (isPurplePeeking ? 4 : -4) : isTyping ? 3 : undefined}
                  forceLookY={showingPassword ? (isPurplePeeking ? 5 : -4) : isTyping ? 4 : undefined} />
                <EyeBall size={18} pupilSize={7} maxDistance={5} eyeColor="white" pupilColor="#0a0a0a"
                  isBlinking={isPurpleBlinking}
                  forceLookX={showingPassword ? (isPurplePeeking ? 4 : -4) : isTyping ? 3 : undefined}
                  forceLookY={showingPassword ? (isPurplePeeking ? 5 : -4) : isTyping ? 4 : undefined} />
              </div>
            </div>

            {/* Black */}
            <div ref={blackRef} className="absolute bottom-0 transition-all duration-700 ease-in-out"
              style={{
                left: 240, width: 120, height: 310,
                backgroundColor: "#2a2a2a", border: "2px solid #FFB81C",
                borderRadius: "8px 8px 0 0", zIndex: 2,
                transform: showingPassword
                  ? "skewX(0deg)"
                  : isTyping
                    ? `skewX(${(bp.bodySkew || 0) * 1.5 + 10}deg) translateX(20px)`
                    : `skewX(${bp.bodySkew || 0}deg)`,
                transformOrigin: "bottom center",
              }}>
              <div className="absolute flex gap-6 transition-all duration-700 ease-in-out"
                style={{
                  left: showingPassword ? 10 : isTyping ? 32 : 26 + bp.faceX,
                  top:  showingPassword ? 28 : isTyping ? 12 : 32 + bp.faceY,
                }}>
                <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#0a0a0a"
                  isBlinking={isBlackBlinking}
                  forceLookX={showingPassword ? -4 : isTyping ? 0 : undefined}
                  forceLookY={showingPassword ? -4 : isTyping ? -4 : undefined} />
                <EyeBall size={16} pupilSize={6} maxDistance={4} eyeColor="white" pupilColor="#0a0a0a"
                  isBlinking={isBlackBlinking}
                  forceLookX={showingPassword ? -4 : isTyping ? 0 : undefined}
                  forceLookY={showingPassword ? -4 : isTyping ? -4 : undefined} />
              </div>
            </div>

            {/* Orange */}
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

            {/* Yellow */}
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

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-8 text-sm" style={{ color: "rgba(255,255,255,0.4)" }}>
          <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
          <a href="#" className="hover:text-white transition-colors">Contact</a>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-[460px]">

          {/* Mobile logo */}
          <Link href="/" className="lg:hidden flex items-center justify-center gap-3 mb-10 hover:opacity-80 transition-opacity">
            <Image src="/logo.svg" alt="OU Roundnet" width={36} height={36} />
            <span className="font-semibold text-gray-900">OU <span style={{ color: "#FFB81C" }}>Roundnet</span></span>
          </Link>

          {/* Header */}
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold tracking-tight mb-2 text-gray-900">
              {verifying ? "Check your email" : "Create an account"}
            </h1>
            <p className="text-gray-500 text-sm">
              {verifying
                ? `We sent a 6-digit code to ${form.email}`
                : "Join the OU Roundnet Club and start competing"}
            </p>
          </div>

          {/* ── OTP verification step ── */}
          {verifying ? (
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="code" className="text-sm font-medium text-gray-700">Verification code</Label>
                <Input
                  id="code"
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="000000"
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  required
                  className="h-11 text-center text-xl tracking-[0.4em] border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]"
                />
              </div>

              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>
              )}

              <button type="submit" disabled={isLoading || code.length < 6}
                className="w-full h-11 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 mt-2"
                style={{ backgroundColor: "#FFB81C", color: "#0a0a0a" }}>
                {isLoading ? "Verifying…" : "Verify & Continue"}
              </button>

              <p className="text-center text-sm text-gray-500">
                Wrong email?{" "}
                <button type="button" onClick={() => { setVerifying(false); setCode(""); setError(""); }}
                  className="font-semibold hover:underline" style={{ color: "#FFB81C" }}>
                  Go back
                </button>
              </p>
            </form>
          ) : (
            /* ── Signup form ── */
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName" className="text-sm font-medium text-gray-700">First name</Label>
                  <Input id="firstName" placeholder="Jane" value={form.firstName}
                    onChange={set("firstName")} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
                    required className="h-11 border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName" className="text-sm font-medium text-gray-700">Last name</Label>
                  <Input id="lastName" placeholder="Doe" value={form.lastName}
                    onChange={set("lastName")} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
                    required className="h-11 border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]" />
                </div>
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-sm font-medium text-gray-700">Email</Label>
                <Input id="email" type="email" placeholder="you@oakland.edu" value={form.email}
                  onChange={set("email")} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
                  required className="h-11 border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]" />
              </div>

              {/* Age + Gender row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="age" className="text-sm font-medium text-gray-700">Age</Label>
                  <Input id="age" type="number" min={16} max={99} placeholder="21" value={form.age}
                    onChange={set("age")} onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
                    required className="h-11 border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="gender" className="text-sm font-medium text-gray-700">Gender</Label>
                  <select id="gender" value={form.gender} onChange={set("gender")} required
                    onFocus={() => setIsTyping(true)} onBlur={() => setIsTyping(false)}
                    className="h-11 w-full rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900
                      focus:outline-none focus:border-[#FFB81C] focus:ring-1 focus:ring-[#FFB81C] transition-colors">
                    <option value="" disabled>Select…</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="prefer-not">Prefer not to say</option>
                  </select>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">Password</Label>
                <div className="relative">
                  <Input id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
                    value={form.password} onChange={set("password")} required
                    className="h-11 pr-10 border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Confirm password */}
              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-sm font-medium text-gray-700">Confirm password</Label>
                <div className="relative">
                  <Input id="confirm" type={showConfirm ? "text" : "password"} placeholder="••••••••"
                    value={form.confirm} onChange={set("confirm")} required
                    className="h-11 pr-10 border-gray-200 focus:border-[#FFB81C] focus:ring-[#FFB81C]" />
                  <button type="button" onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition-colors">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg">{error}</div>
              )}

              <button type="submit" disabled={isLoading || !isLoaded}
                className="w-full h-11 rounded-lg font-semibold text-sm transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60 mt-2"
                style={{ backgroundColor: "#FFB81C", color: "#0a0a0a" }}>
                {isLoading ? "Creating account…" : "Create account"}
              </button>
            </form>
          )}

          {!verifying && (
            <p className="text-center text-sm text-gray-500 mt-6">
              Already have an account?{" "}
              <Link href="/login" className="font-semibold hover:underline" style={{ color: "#FFB81C" }}>
                Log in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export const Component = SignupPage;
