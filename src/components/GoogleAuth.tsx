/**
 * Google OAuth 登入元件
 * 處理 Google 帳號登入/登出功能
 */

import React, { useEffect, useState } from 'react';
import { UserInfo } from '../App';
import './GoogleAuth.css';

interface GoogleAuthProps {
  isLoggedIn: boolean;
  userInfo: UserInfo | null;
  onLoginSuccess: (userInfo: UserInfo) => void;
  onLogout: () => void;
}

// Google OAuth 回應介面
interface GoogleAuthResponse {
  access_token: string;
  expires_in: number;
  scope: string;
  token_type: string;
}

interface GoogleUserInfo {
  email: string;
  name: string;
  picture?: string;
}

const GoogleAuth: React.FC<GoogleAuthProps> = ({
  isLoggedIn,
  userInfo,
  onLoginSuccess,
  onLogout
}) => {
  const [isInitialized, setIsInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const CLIENT_ID = process.env.REACT_APP_GOOGLE_CLIENT_ID || '';
  const API_KEY = process.env.REACT_APP_GOOGLE_API_KEY || '';
  const SCOPES = 'https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email';

  useEffect(() => {
    // 檢查環境變數
    if (!CLIENT_ID || !API_KEY) {
      setError('Google API 憑證未設定。請在 .env.local 中設定 REACT_APP_GOOGLE_CLIENT_ID 和 REACT_APP_GOOGLE_API_KEY');
      return;
    }

    // 初始化 Google Identity Services
    const initializeGoogleAuth = () => {
      if (typeof window.google === 'undefined') {
        // 載入 Google Identity Services 腳本
        const script = document.createElement('script');
        script.src = 'https://accounts.google.com/gsi/client';
        script.async = true;
        script.defer = true;
        script.onload = () => {
          setIsInitialized(true);
          console.log('✅ Google Identity Services 初始化完成');
        };
        script.onerror = () => {
          setError('無法載入 Google Identity Services');
        };
        document.head.appendChild(script);
      } else {
        setIsInitialized(true);
      }
    };

    initializeGoogleAuth();

    // 檢查 localStorage 中的登入狀態
    const savedUserInfo = localStorage.getItem('googleUserInfo');
    const savedAccessToken = localStorage.getItem('googleAccessToken');
    
    if (savedUserInfo && savedAccessToken) {
      try {
        const user = JSON.parse(savedUserInfo);
        onLoginSuccess({
          ...user,
          accessToken: savedAccessToken
        });
      } catch (e) {
        console.error('無法還原登入狀態:', e);
        localStorage.removeItem('googleUserInfo');
        localStorage.removeItem('googleAccessToken');
      }
    }
  }, [CLIENT_ID, API_KEY, onLoginSuccess]);

  /**
   * 處理 Google 登入
   */
  const handleLogin = () => {
    if (!isInitialized || !window.google) {
      setError('Google Identity Services 尚未載入');
      return;
    }

    try {
      const client = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: async (response: GoogleAuthResponse) => {
          if (response.access_token) {
            // 取得用戶資訊
            try {
              const userInfoResponse = await fetch(
                'https://www.googleapis.com/oauth2/v2/userinfo',
                {
                  headers: {
                    Authorization: `Bearer ${response.access_token}`
                  }
                }
              );

              if (userInfoResponse.ok) {
                const userData: GoogleUserInfo = await userInfoResponse.json();
                
                const userInfo: UserInfo = {
                  email: userData.email,
                  name: userData.name,
                  picture: userData.picture,
                  accessToken: response.access_token
                };

                // 儲存到 localStorage
                localStorage.setItem('googleUserInfo', JSON.stringify({
                  email: userInfo.email,
                  name: userInfo.name,
                  picture: userInfo.picture
                }));
                localStorage.setItem('googleAccessToken', response.access_token);

                onLoginSuccess(userInfo);
                setError(null);

                console.log('✅ Google 登入成功:', userData.email);
              } else {
                throw new Error('無法取得用戶資訊');
              }
            } catch (err) {
              console.error('❌ 取得用戶資訊失敗:', err);
              setError('登入失敗：無法取得用戶資訊');
            }
          }
        },
        error_callback: (error: any) => {
          console.error('❌ Google 登入錯誤:', error);
          setError(`登入失敗：${error.message || '未知錯誤'}`);
        }
      });

      client.requestAccessToken();
    } catch (err) {
      console.error('❌ 初始化 Google 登入失敗:', err);
      setError('登入失敗：請檢查網路連線');
    }
  };

  /**
   * 處理登出
   */
  const handleLogout = () => {
    // 清除 localStorage
    localStorage.removeItem('googleUserInfo');
    localStorage.removeItem('googleAccessToken');
    
    // 撤銷 access token（可選）
    if (userInfo?.accessToken) {
      window.google?.accounts.oauth2.revoke(userInfo.accessToken, () => {
        console.log('✅ Access token 已撤銷');
      });
    }

    onLogout();
    console.log('✅ 已登出');
  };

  if (error) {
    return (
      <div className="google-auth-container">
        <div className="auth-error">
          <span className="error-icon">⚠️</span>
          <span className="error-message">{error}</span>
        </div>
      </div>
    );
  }

  if (!isInitialized) {
    return (
      <div className="google-auth-container">
        <div className="auth-loading">
          <span className="loading-spinner">⏳</span>
          <span>載入中...</span>
        </div>
      </div>
    );
  }

  if (isLoggedIn && userInfo) {
    return (
      <div className="google-auth-container logged-in">
        <div className="user-info">
          {userInfo.picture && (
            <img 
              src={userInfo.picture} 
              alt={userInfo.name}
              className="user-avatar"
            />
          )}
          <div className="user-details">
            <div className="user-name">{userInfo.name}</div>
            <div className="user-email">{userInfo.email}</div>
          </div>
        </div>
        <button 
          className="logout-button"
          onClick={handleLogout}
        >
          登出
        </button>
      </div>
    );
  }

  return (
    <div className="google-auth-container">
      <button 
        className="login-button"
        onClick={handleLogin}
      >
        <svg className="google-icon" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
        </svg>
        <span>使用 Google 帳號登入</span>
      </button>
    </div>
  );
};

// TypeScript 全域型別擴展
declare global {
  interface Window {
    google: any;
  }
}

export default GoogleAuth;

