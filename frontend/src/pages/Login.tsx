import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock } from 'lucide-react';
import type { LoginCredentials } from '../types/user.types';
import { login } from '../lib/api';

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginCredentials>();
  const navigate = useNavigate();

  const onSubmit = async (data: LoginCredentials) => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await login(data);
      
      // Store token
      localStorage.setItem('token', response.token);
      
      // Force a re-render of App component
      window.dispatchEvent(new Event('storage'));
      
      // Navigate to dashboard
      navigate('/dashboard/upload');
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Login failed');
      console.error('Login failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-4xl w-full min-h-[600px] flex">
        {/* Left Side - Form */}
        <div className="relative z-10 flex-1 flex items-center justify-center p-8 lg:p-12">
          <div className="w-full max-w-sm space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3">Welcome back</h1>
              <p className="text-gray-600">Please enter your details to sign in</p>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-600" />
                    <input
                      {...register("email", { 
                        required: "Email is required",
                        pattern: {
                          value: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
                          message: "Invalid email address"
                        }
                      })}
                      type="email"
                      className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all bg-white hover:bg-gray-50"
                      placeholder="Enter your email"
                    />
                  </div>
                  {errors.email && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.email.message}</span>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-600" />
                    <input
                      {...register("password", { required: "Password is required" })}
                      type={showPassword ? "text" : "password"}
                      className="w-full pl-10 pr-12 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all bg-white hover:bg-gray-50"
                      placeholder="••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 bg-transparent border-none outline-none focus:outline-none"
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                  {errors.password && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.password.message}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    {...register("remember")}
                    className="rounded border-gray-300 text-purple-600 focus:ring-purple-500 bg-gray-50"
                  />
                  <span className="ml-2 text-sm text-gray-600">Remember me</span>
                </label>
                <Link to="/forgot-password" className="text-sm text-purple-600 hover:text-purple-700 transition-colors">
                  Forgot password?
                </Link>
              </div>

              {error && (
                <div className="bg-red-50 text-red-500 p-3 rounded-lg text-sm mb-4">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-purple-600 text-white py-3.5 rounded-xl hover:bg-purple-700 transition-all font-semibold text-lg shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50"
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600">
              Don't have an account?{' '}
              <Link to="/signup" className="text-purple-600 hover:text-purple-700 font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>

        {/* Right Side - Welcome Section */}
        <div className="relative hidden lg:flex flex-1 bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800">
          <div className="absolute inset-0 bg-[url('/grid.svg')] opacity-20"></div>
          <div className="relative z-10 flex items-center justify-center p-12">
            <div className="max-w-md text-white">
              <h2 className="text-4xl font-bold mb-6">Welcome Back!</h2>
              <p className="text-purple-100 text-lg leading-relaxed opacity-90">
                Sign in to continue your journey with us. We're excited to have you back.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
