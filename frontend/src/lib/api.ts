const API_BASE_URL = 'http://localhost:5000/api/user'; // Updated base URL

interface RegisterData {
  firstname: string;
  lastname: string;
  email: string;
  password: string;
  phonenumber?: string;
}

interface LoginData {
  email: string;
  password: string;
}

interface AuthResponse {
  success: boolean;
  message: string;
  token: string;
  user: {
    firstname: string;
    lastname: string;
    email: string;
    phonenumber?: string;
  };
}

interface UserProfile {
  id: string;
  fullname: {
    firstname: string;
    lastname: string;
  };
  email: string;
  phonenumber?: string;
  createdAt: string;
}

const handleResponse = async (response: Response) => {
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.message || 'An error occurred');
  }

  return data;
};

export const register = async (data: RegisterData): Promise<AuthResponse> => {
  try {
    console.log('Sending registration data:', data); // Debug log

    const response = await fetch(`${API_BASE_URL}/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({
        fullname: {
          firstname: data.firstname,
          lastname: data.lastname,
        },
        email: data.email,
        password: data.password,
        phonenumber: data.phonenumber,
      }),
    });

    const responseData = await response.json();

    if (!response.ok) {
      throw new Error(responseData.message || 'Registration failed');
    }

    return responseData;
  } catch (error) {
    console.error('Registration error details:', error);
    throw error;
  }
};

export const login = async (data: LoginData): Promise<AuthResponse> => {
  try {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
      credentials: 'include',
    });

    return handleResponse(response);
  } catch (error) {
    console.error('Login error:', error);
    throw new Error(
      error instanceof Error
        ? error.message
        : 'Failed to login. Please try again.'
    );
  }
};

export const getProfile = async (): Promise<UserProfile> => {
  try {
    const response = await fetch(`${API_BASE_URL}/profile`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json',
      },
      credentials: 'include',
    });

    return handleResponse(response);
  } catch (error) {
    console.error('Profile fetch error:', error);
    throw new Error('Failed to fetch profile');
  }
};
