import { useEffect, useState } from 'react';
import { supabase } from '../integrations/supabase/client';
import zxcvbn from 'zxcvbn';

interface FormState {
    password: string;
    confirmPassword: string;
}

interface Message {
    text: string;
    type: 'success' | 'error';
}

export default function ResetPassword() {
    const [formState, setFormState] = useState<FormState>({
        password: '',
        confirmPassword: '',
    });
    const [message, setMessage] = useState<Message | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isFormValid, setIsFormValid] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [passwordStrength, setPasswordStrength] = useState(0);
    const [userEmail, setUserEmail] = useState<string | null>(null);

    // Validate password and check strength
    useEffect(() => {
        const { password, confirmPassword } = formState;
        const score = zxcvbn(password).score;
        setPasswordStrength(score);

        const isValid =
            password.length >= 8 &&
            /[A-Z]/.test(password) &&
            /[0-9]/.test(password) &&
            confirmPassword === password &&
            score >= 1;

        setIsFormValid(isValid);
    }, [formState]);

    // Supabase session check and email fetch
    useEffect(() => {
        const { data: authListener } = supabase.auth.onAuthStateChange(
            async (event, session) => {
                if (event === 'PASSWORD_RECOVERY') {
                    setUserEmail(session?.user?.email ?? null);
                }
            }
        );

        supabase.auth.getSession().then(({ data, error }) => {
            if (error || !data.session) {
                console.error('Session error:', error);
                setMessage({ text: 'This link is invalid or has expired.', type: 'error' });
            } else {
                setUserEmail(data.session.user?.email ?? null);
            }
        });

        return () => {
            authListener.subscription.unsubscribe();
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setFormState((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!isFormValid) return;

        setIsLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.updateUser({
                password: formState.password,
            });

            if (error) {
                throw new Error(error.message);
            }

            setMessage({
                text: 'Password updated successfully! Redirecting to login...',
                type: 'success',
            });
            setFormState({ password: '', confirmPassword: '' });

            setTimeout(() => {
                window.location.href = '/';
            }, 2000);
        } catch (error) {
            setMessage({
                text: error instanceof Error ? error.message : 'Unexpected error occurred',
                type: 'error',
            });
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
            <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg max-w-md w-full">
                <h2 className="text-2xl font-bold mb-6 text-center text-black dark:text-white">
                    Reset Your Password
                </h2>

                {userEmail && (
                    <p className="text-center text-sm text-gray-600 dark:text-gray-300 mb-4">
                        Updating password for <span className="font-semibold">{userEmail}</span>
                    </p>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Password */}
                    <div>
                        <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            New Password
                        </label>
                        <div className="relative">
                            <input
                                id="password"
                                name="password"
                                type={showPassword ? 'text' : 'password'}
                                value={formState.password}
                                onChange={handleInputChange}
                                placeholder="Enter new password"
                                className="mt-1 block w-full text-black dark:text-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                required
                                minLength={8}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                                {showPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                            At least 8 characters, with an uppercase letter and number.
                        </p>

                        <div className="mt-2 h-2 rounded bg-gray-300 dark:bg-gray-600">
                            <div
                                className={`h-full rounded transition-all duration-300 ${['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-400', 'bg-green-600'][passwordStrength]
                                    }`}
                                style={{ width: `${(passwordStrength + 1) * 20}%` }}
                            />
                        </div>
                        <div className="text-xs mt-1 text-gray-500 dark:text-gray-400">
                            Strength: {['Weak', 'Fair', 'Good', 'Strong'][passwordStrength]}
                        </div>
                    </div>

                    {/* Confirm Password */}
                    <div>
                        <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Confirm Password
                        </label>
                        <div className="relative">
                            <input
                                id="confirmPassword"
                                name="confirmPassword"
                                type={showConfirmPassword ? 'text' : 'password'}
                                value={formState.confirmPassword}
                                onChange={handleInputChange}
                                placeholder="Confirm new password"
                                className="mt-1 block w-full text-black dark:text-white dark:bg-gray-700 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                            >
                                {showConfirmPassword ? '🙈' : '👁️'}
                            </button>
                        </div>
                    </div>

                    {/* Message */}
                    {message && (
                        <div
                            className={`p-3 rounded-md text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                }`}
                        >
                            {message.text}
                        </div>
                    )}

                    {/* Submit */}
                    <button
                        type="submit"
                        disabled={!isFormValid || isLoading}
                        className={`w-full py-2 px-4 border rounded-md text-white font-medium
                            ${isFormValid && !isLoading ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-gray-400 cursor-not-allowed'}
                        `}
                    >
                        {isLoading ? 'Updating...' : 'Update Password'}
                    </button>
                </form>
            </div>
        </div>
    );
}
