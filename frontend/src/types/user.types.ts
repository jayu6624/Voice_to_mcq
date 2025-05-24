export interface User {
  fullname: {
    firstname: string;
    lastname?: string;
  };
  email: string;
  phonenumber?: string;
  password: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
  remember?: boolean;
}
