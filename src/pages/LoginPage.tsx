import React, { useState } from 'react';

interface LoginPageProps {
  onLogin: (userData: any) => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [teamName, setTeamName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // URL вашего API на хостинге
  // Замените на реальный домен после деплоя
  const API_URL = '/api.php'; 

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const action = isLoginMode ? 'login' : 'register_team';
      
      const payload: any = { email, password };
      if (!isLoginMode) {
        payload.teamName = teamName;
      }

      const response = await fetch(`${API_URL}?action=${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Произошла ошибка');
      }

      if (isLoginMode) {
        // Успешный вход
        onLogin(data.user);
      } else {
        // Успешная регистрация - переключаемся на вход
        alert('Команда успешно создана! Теперь войдите в систему.');
        setIsLoginMode(true);
        setTeamName('');
        setEmail('');
        setPassword('');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>{isLoginMode ? 'Вход в систему' : 'Регистрация команды'}</h1>
        
        <form onSubmit={handleSubmit} style={styles.form}>
          {!isLoginMode && (
            <div style={styles.inputGroup}>
              <label style={styles.label}>Название команды</label>
              <input
                type="text"
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Введите название команды"
                style={styles.input}
                required={!isLoginMode}
              />
            </div>
          )}

          <div style={styles.inputGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Введите email"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Пароль</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Введите пароль"
              style={styles.input}
              required
              minLength={6}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button 
            type="submit" 
            style={{...styles.button, ...(loading ? styles.buttonDisabled : {})}}
            disabled={loading}
          >
            {loading ? 'Загрузка...' : (isLoginMode ? 'Войти' : 'Зарегистрировать команду')}
          </button>
        </form>

        <div style={styles.switchText}>
          {isLoginMode ? 'Нет аккаунта?' : 'Уже есть аккаунт?'}
          <button 
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError('');
            }}
            style={styles.switchButton}
          >
            {isLoginMode ? 'Зарегистрировать команду' : 'Войти'}
          </button>
        </div>
      </div>
    </div>
  );
};

const styles: { [key: string]: React.CSSProperties } = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    padding: '20px',
  },
  card: {
    background: 'white',
    borderRadius: '12px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
  },
  title: {
    textAlign: 'center',
    color: '#333',
    marginBottom: '30px',
    fontSize: '24px',
    fontWeight: 600,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    color: '#555',
    fontWeight: 500,
  },
  input: {
    padding: '12px 16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    fontSize: '16px',
    transition: 'border-color 0.2s',
    outline: 'none',
  },
  button: {
    padding: '14px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    fontSize: '16px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'transform 0.2s, box-shadow 0.2s',
  },
  buttonDisabled: {
    opacity: 0.7,
    cursor: 'not-allowed',
  },
  error: {
    color: '#e74c3c',
    fontSize: '14px',
    textAlign: 'center',
    padding: '10px',
    background: '#fdecea',
    borderRadius: '6px',
  },
  switchText: {
    textAlign: 'center',
    marginTop: '20px',
    fontSize: '14px',
    color: '#666',
  },
  switchButton: {
    background: 'none',
    border: 'none',
    color: '#667eea',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
    marginLeft: '5px',
    textDecoration: 'underline',
  },
};
