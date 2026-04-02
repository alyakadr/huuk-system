import http from "./httpClient";

const API_BASE_URL = process.env.REACT_APP_API_URL
  ? `${process.env.REACT_APP_API_URL}/api`
  : "http://localhost:5000/api";

export async function getTotalCustomersAll() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    console.log(
      "Fetching /customers/total-all with token:",
      token.slice(0, 20) + "...",
    );
    const response = await http.get(`${API_BASE_URL}/customers/total-all`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    return response.data.count;
  } catch (error) {
    console.error("Error fetching all customers:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
}

export async function getTotalCustomersUpToYesterday() {
  try {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("No authentication token found");
    }
    console.log(
      "Fetching /customers/total-up-to-yesterday with token:",
      token.slice(0, 20) + "...",
    );
    const response = await http.get(
      `${API_BASE_URL}/customers/total-up-to-yesterday`,
      {
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    return response.data.count;
  } catch (error) {
    console.error("Error fetching customers up to yesterday:", {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status,
    });
    throw error;
  }
}
