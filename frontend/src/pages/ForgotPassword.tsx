import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { MainLayout } from '@/components/layout/MainLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { apiClient } from '@/api';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Gavel, ArrowLeft, CheckCircle } from 'lucide-react';

type Step = 'email' | 'otp' | 'reset' | 'success';

export default function ForgotPassword() {
  const [step, setStep] = useState<Step>('email');
  const [isLoading, setIsLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [otpToken, setOtpToken] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiClient.auth.requestPasswordRecovery({ username });
      if (response.otp_token) {
        setOtpToken(response.otp_token);
        setStep('otp');
        toast({
          title: 'Code sent',
          description: 'Check your email for the verification code.',
        });
      }
    } catch (error: any) {
      toast({
        title: 'Request failed',
        description: error.response?.data?.detail || 'User not found. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await apiClient.auth.verifyPasswordRecoveryOTP({
        otp_code: otpCode,
        otp_token: otpToken,
        username,
      });
      if (response.reset_token) {
        setResetToken(response.reset_token);
        setStep('reset');
      }
    } catch (error: any) {
      toast({
        title: 'Verification failed',
        description: error.response?.data?.detail || 'Invalid code. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast({
        title: 'Passwords do not match',
        description: 'Please make sure your passwords match.',
        variant: 'destructive',
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: 'Password too short',
        description: 'Password must be at least 8 characters.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);

    try {
      await apiClient.auth.resetPassword({
        reset_token: resetToken,
        new_password: newPassword,
      });
      setStep('success');
    } catch (error: any) {
      toast({
        title: 'Reset failed',
        description: error.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleResendOTP = async () => {
    try {
      const response = await apiClient.auth.requestPasswordRecovery({ username });
      if (response.otp_token) {
        setOtpToken(response.otp_token);
      }
      toast({
        title: 'Code resent',
        description: 'A new verification code has been sent.',
      });
    } catch (error: any) {
      toast({
        title: 'Failed to resend',
        description: error.response?.data?.detail || 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  return (
    <MainLayout hideFooter>
      <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                {step === 'success' ? (
                  <CheckCircle className="h-6 w-6 text-green-600" />
                ) : (
                  <Gavel className="h-6 w-6 text-primary" />
                )}
              </div>
            </div>
            <CardTitle className="text-2xl">
              {step === 'email' && 'Forgot Password'}
              {step === 'otp' && 'Verify Code'}
              {step === 'reset' && 'Reset Password'}
              {step === 'success' && 'Password Reset!'}
            </CardTitle>
            <CardDescription>
              {step === 'email' && 'Enter your username to receive a verification code'}
              {step === 'otp' && 'Enter the 6-digit code sent to your email'}
              {step === 'reset' && 'Create a new password for your account'}
              {step === 'success' && 'Your password has been successfully reset'}
            </CardDescription>
          </CardHeader>

          {step === 'email' && (
            <form onSubmit={handleRequestRecovery}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="Enter your username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending code...
                    </>
                  ) : (
                    'Send Verification Code'
                  )}
                </Button>
                <Link to="/login" className="text-sm text-primary hover:underline">
                  <ArrowLeft className="inline h-3 w-3 mr-1" />
                  Back to login
                </Link>
              </CardFooter>
            </form>
          )}

          {step === 'otp' && (
            <form onSubmit={handleVerifyOTP}>
              <CardContent className="space-y-6">
                <div className="flex justify-center">
                  <InputOTP
                    maxLength={6}
                    value={otpCode}
                    onChange={(value) => setOtpCode(value)}
                    disabled={isLoading}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
                <div className="text-center">
                  <button
                    type="button"
                    onClick={handleResendOTP}
                    className="text-sm text-primary hover:underline"
                  >
                    Didn't receive code? Resend
                  </button>
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button
                  type="submit"
                  className="w-full"
                  disabled={isLoading || otpCode.length !== 6}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Code'
                  )}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep('email')}
                >
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back
                </Button>
              </CardFooter>
            </form>
          )}

          {step === 'reset' && (
            <form onSubmit={handleResetPassword}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="Enter new password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    required
                    disabled={isLoading}
                    minLength={8}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="Confirm new password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-4">
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </Button>
              </CardFooter>
            </form>
          )}

          {step === 'success' && (
            <CardFooter className="flex flex-col gap-4">
              <Button className="w-full" onClick={() => navigate('/login')}>
                Go to Login
              </Button>
            </CardFooter>
          )}
        </Card>
      </div>
    </MainLayout>
  );
}
