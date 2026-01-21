import React, { useState, useEffect } from "react";
import api from "../../utils/api";
import "../../styles/customerManagement.css";

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchCustomers = async () => {
      try {
        const response = await api.get("/customers/list");
        if (!Array.isArray(response.data)) {
          throw new Error("Invalid response format: Expected an array");
        }
        setCustomers(response.data);
      } catch (err) {
        console.error("Error fetching customers:", {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
        });
        setError(`Failed to fetch customers: ${err.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCustomers();
  }, []);

  if (isLoading) return <div>Loading customers...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="customer-management-container">
      <h2>Customer Management</h2>
      <table className="customer-table">
        <thead>
          <tr>
            <th>Full Name</th>
            <th>Username</th>
            <th>Email</th>
            <th>Registration Date</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td colSpan="4">No customers found.</td>
            </tr>
          ) : (
            customers.map((customer) => (
              <tr key={customer.id}>
                <td>{customer.fullname || "(No name)"}</td>
                <td>{customer.username || "(No username)"}</td>
                <td>{customer.email}</td>
                <td>
                  {new Date(customer.created_at).toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CustomerManagement;
