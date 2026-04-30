import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';


export const LoginPage = () => {
    console.log('LoginPage Mounting...');
    const navigate = useNavigate();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        console.log('=== LOGIN ATTEMPT ===');
        console.log('Email:', username);

        try {
            console.log('Attempting authentication...');
            const { data, error } = await supabase.auth.signInWithPassword({
                email: username,
                password: password,
            });

            if (error) {
                console.error('❌ Authentication failed:', error);
                setError(error.message);
                return;
            }

            console.log('✅ Authentication successful');

            if (data.user) {
                // 1. Check if user profile exists by auth user ID
                let { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', data.user.id)
                    .single();

                // 2. If no profile found by ID, check if one exists by email (common when manually added with wrong ID)
                if (!profile && data.user.email) {
                    console.log('No profile found by auth ID, searching by email...');
                    const { data: emailProfiles } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('email', data.user.email);

                    if (emailProfiles && emailProfiles.length > 0) {
                        console.log(`Found ${emailProfiles.length} profile(s) by email. Fixing ID mismatch...`);
                        
                        // Use the first profile found and update its ID to match the auth user ID
                        const targetProfile = emailProfiles[0];
                        
                        // Delete any extra duplicate profiles for this email (keep only one)
                        if (emailProfiles.length > 1) {
                            const idsToDelete = emailProfiles.slice(1).map(p => p.id);
                            console.log('Cleaning up duplicate profiles:', idsToDelete);
                            await supabase
                                .from('profiles')
                                .delete()
                                .in('id', idsToDelete);
                        }

                        // Update the remaining profile's ID to match the auth user ID
                        if (targetProfile.id !== data.user.id) {
                            console.log(`Updating profile ID from ${targetProfile.id} to ${data.user.id}`);
                            
                            // Delete the old profile and re-insert with correct ID
                            const { error: deleteError } = await supabase
                                .from('profiles')
                                .delete()
                                .eq('id', targetProfile.id);

                            if (!deleteError) {
                                const { data: fixedProfile, error: insertError } = await supabase
                                    .from('profiles')
                                    .insert([{
                                        ...targetProfile,
                                        id: data.user.id,
                                    }])
                                    .select()
                                    .single();

                                if (!insertError && fixedProfile) {
                                    console.log('Profile ID fixed successfully!');
                                    profile = fixedProfile;
                                } else {
                                    console.error('Failed to re-insert profile with correct ID:', insertError);
                                }
                            }
                        } else {
                            profile = targetProfile;
                        }
                    }
                }

                // 3. SELF-HEALING: If still no profile, create from auth metadata
                if (!profile && data.user.user_metadata) {
                    console.log('Creating profile from auth metadata...');
                    const meta = data.user.user_metadata;
                    const { data: newProfile, error: createError } = await supabase
                        .from('profiles')
                        .insert([{
                            id: data.user.id,
                            email: data.user.email,
                            full_name: meta.full_name || data.user.email?.split('@')[0],
                            role: meta.role || 'employee',
                            org_id: meta.org_id
                        }])
                        .select()
                        .single();
                    
                    if (!createError) profile = newProfile;
                }

                if (!profile) {
                    console.error('❌ No profile found and auto-creation failed');
                    await supabase.auth.signOut();
                    setError('Your account is missing a profile. Please contact support.');
                    return;
                }

                // 3. Navigation based on validated profile
                const role = (profile.role || 'employee').toLowerCase().trim();
                console.log('Navigating with role:', role);

                switch (role) {
                    case 'executive':
                    case 'admin':
                        navigate('/executive-dashboard');
                        break;
                    case 'super_admin':
                    case 'superadmin':
                        navigate('/super-admin');
                        break;
                    case 'manager':
                        navigate('/manager-dashboard');
                        break;
                    case 'team_lead':
                        navigate('/teamlead-dashboard');
                        break;
                    case 'employee':
                        navigate('/employee-dashboard');
                        break;
                    default:
                        navigate('/employee-dashboard');
                }
            }
        } catch (err) {
            console.error('❌ Unexpected error during login:', err);
            setError('An unexpected error occurred');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center p-4 relative font-sans" style={{ background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 50%, #f0f9ff 100%)' }}>
            {/* Main Login Card */}
            <div className="w-full max-w-[420px] relative z-10 mx-auto">
                <div className="bg-white rounded-2xl p-10 md:p-12 shadow-[0_8px_30px_rgba(0,0,0,0.04)] border border-gray-50 flex flex-col items-center">
                    
                    {/* Logo & Title */}
                    <div className="text-center mb-10 flex flex-col items-center">
                        <div className="text-[32px] font-serif text-[#8b5cf6] font-bold mb-2">T</div>
                        <h2 className="text-[26px] font-serif font-bold text-gray-900 tracking-tight mb-2">Talent Ops</h2>
                        <p className="text-[14px] text-gray-400 italic font-serif">Enter the Zone</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4 w-full">
                        <div className="relative">
                            <input
                                type="text"
                                className="w-full bg-[#f8fafc] border border-transparent rounded-[8px] px-4 py-[14px] text-gray-900 text-[14px] placeholder:text-gray-400 focus:outline-none focus:border-gray-200 focus:bg-white transition-all font-medium"
                                placeholder="Email"
                                autoFocus
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>

                        <div className="relative flex flex-col gap-2">
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    className="w-full bg-[#f8fafc] border border-transparent rounded-[8px] px-4 py-[14px] text-gray-900 text-[14px] placeholder:text-gray-400 focus:outline-none focus:border-gray-200 focus:bg-white transition-all font-medium pr-12"
                                    placeholder="Password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                                    onClick={() => setShowPassword(!showPassword)}
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>

                        <div className="pt-1 pb-3 flex justify-end">
                            <Link
                                to="/forgot-password"
                                className="text-[10px] font-bold text-gray-500 hover:text-gray-900 transition-colors uppercase tracking-[0.05em]"
                            >
                                FORGOT PASSWORD?
                            </Link>
                        </div>

                        {error && (
                            <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-red-500 text-xs text-center font-medium mb-4">
                                {error}
                            </div>
                        )}

                        <div className="pt-2">
                            <button
                                type="submit"
                                className="w-full bg-[#0a0a0a] hover:bg-black text-white font-bold text-[12px] py-[16px] rounded-[6px] transition-all duration-200 tracking-widest uppercase"
                            >
                                LOGIN
                            </button>
                        </div>
                    </form>

                    <div className="mt-8 pt-4 w-full text-center">
                        <Link
                            to="/"
                            className="text-[11px] font-semibold text-gray-400 hover:text-gray-900 transition-colors tracking-wide uppercase"
                        >
                            ← BACK TO HOME
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
};
