import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Mail, Lock, User, Phone } from 'lucide-react';
import type { User as UserType } from '../types/user.types';
import { register } from '../lib/api';

export default function Signup() {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { register: formRegister, handleSubmit, formState: { errors } } = useForm<UserType>();
  const navigate = useNavigate();

  const onSubmit = async (data: UserType) => {
    try {
      setIsLoading(true);
      setError(null);
      
      const registerData = {
        firstname: data.fullname.firstname,
        lastname: data.fullname.lastname || '',
        email: data.email,
        password: data.password,
        phonenumber: data.phonenumber || undefined,
      };

      const response = await register(registerData);
      // Store token in localStorage
      localStorage.setItem('token', response.token);
      // Navigate directly to dashboard
      navigate('/dashboard');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Registration failed';
      setError(errorMessage);
      console.error('Signup failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center p-4">
      <div className="relative bg-white rounded-3xl shadow-2xl overflow-hidden max-w-5xl w-full min-h-[700px] flex">
        {/* Left Side - Form */}
        <div className="relative z-10 flex-1 flex items-center justify-center p-8 lg:p-12">
          <div className="w-full max-w-md space-y-8">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 mb-3">Create Account</h1>
              <p className="text-gray-600">Sign up to get started with your new account</p>
            </div>
            
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-600" />
                    <input
                      {...formRegister("fullname.firstname", { required: "First name is required", minLength: { value: 3, message: "First name must be at least 3 characters" } })}
                      type="text"
                      className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all bg-white hover:bg-gray-50"
                      placeholder="First Name"
                    />
                  </div>
                  {errors.fullname?.firstname && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.fullname.firstname.message}</span>
                  )}
                </div>
                <div>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-600" />
                    <input
                      {...formRegister("fullname.lastname", { minLength: { value: 3, message: "Last name must be at least 3 characters" } })}
                      type="text"
                      className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all bg-white hover:bg-gray-50"
                      placeholder="Last Name"
                    />
                  </div>
                  {errors.fullname?.lastname && (
                    <span className="text-red-500 text-sm mt-1 block">{errors.fullname.lastname.message}</span>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-600" />
                  <input
                    {...formRegister("email", {
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
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-600" />
                  <input
                    {...formRegister("phonenumber", { minLength: { value: 10, message: "Phone number must be at least 10 digits" } })}
                    type="tel"
                    className="w-full pl-10 pr-4 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all bg-white hover:bg-gray-50"
                    placeholder="Phone Number"
                  />
                </div>
                {errors.phonenumber && (
                  <span className="text-red-500 text-sm mt-1 block">{errors.phonenumber.message}</span>
                )}
              </div>

              <div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-purple-600" />
                  <input
                    {...formRegister("password", { required: "Password is required" })}
                    type={showPassword ? "text" : "password"}
                    className="w-full pl-10 pr-12 py-3.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-600 focus:border-transparent transition-all bg-white hover:bg-gray-50"
                    placeholder="Password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 bg-transparent border-none outline-none focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
                {errors.password && <span className="text-red-500 text-sm mt-1 block">{errors.password.message}</span>}
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
                {isLoading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>

            <p className="text-center text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-purple-600 hover:text-purple-700 font-medium">
                Sign in
              </Link>
            </p>
          </div>
        </div>

        {/* Right Side - Welcome Section */}
        <div className="relative flex-1 bg-gradient-to-br from-purple-600 via-purple-700 to-purple-800 items-center justify-center p-12 hidden lg:flex">
          {/* Additional curved decoration */}
          <div className="absolute inset-0">
            <svg 
              viewBox="0 0 400 700" 
              className="absolute right-0 top-0 w-full h-full"
              preserveAspectRatio="xMidYMid slice"
            >
              <path 
                d="M0,450 C50,430 100,410 150,420 C200,430 250,450 300,440 C350,430 380,410 400,420 L400,0 L0,0 Z" 
                fill="rgba(255,255,255,0.1)"
              />
            </svg>
          </div>
          
          <div className="relative z-10 max-w-md text-white">
            <h2 className="text-4xl font-bold mb-6">Join Us Today!</h2>
            <p className="text-purple-100 text-lg leading-relaxed">
              Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed pharetra magna nisl, at
              posuere sem dapibus sed.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
