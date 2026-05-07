const BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL || 'http://192.168.1.216:8001';

const jsonHeaders = {
  'Content-Type': 'application/json',
};

const authHeaders = (token) => ({
  Authorization: `Bearer ${token}`,
  ...jsonHeaders,
});

const registerUser = async ({ firebase_uid, email, display_name }) => {
  return fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({
      firebase_uid,
      email,
      display_name,
    }),
  });
};

const loginUser = async (idToken) => {
  return fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: jsonHeaders,
    body: JSON.stringify({ id_token: idToken }),
  });
};

const post = async (endpoint, token, data) => {
  return fetch(`${BACKEND_URL}${endpoint}`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(data),
  });
};

const get = async (endpoint, token) => {
  return fetch(`${BACKEND_URL}${endpoint}`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
};

const reportEmergencyIncident = async (token, data) => {
  return post('/api/incidents/emergency', token, data);
};

export {
  BACKEND_URL,
  registerUser,
  loginUser,
  post,
  get,
  authHeaders,
  reportEmergencyIncident,
};
