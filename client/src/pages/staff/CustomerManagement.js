import React, { useState, useEffect } from "react";
import api from "../../utils/api";

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

  if (isLoading)
    return (
      <div className="min-h-[40vh] flex items-center justify-center text-white">
        Loading customers...
      </div>
    );
  if (error)
    return (
      <div className="text-red-400 bg-red-950/40 border border-red-600 rounded-huuk-sm p-3">
        {error}
      </div>
    );

  return (
    <div
      className="card-dark rounded-huuk-lg"
      style={{ height: "100%", overflowY: "auto", overflowX: "hidden" }}
    >
      <h2 className="text-2xl font-bold mb-4">Customer Management</h2>
      <table className="huuk-table">
        <thead>
          <tr>
            <th className="huuk-th">Full Name</th>
            <th className="huuk-th">Username</th>
            <th className="huuk-th">Email</th>
            <th className="huuk-th">Registration Date</th>
          </tr>
        </thead>
        <tbody>
          {customers.length === 0 ? (
            <tr>
              <td colSpan="4" className="huuk-td text-center py-6">
                No customers found.
              </td>
            </tr>
          ) : (
            customers.map((customer) => (
              <tr
                key={customer.id}
                className="huuk-tr border-b border-white/10"
              >
                <td className="huuk-td">{customer.fullname || "(No name)"}</td>
                <td className="huuk-td">
                  {customer.username || "(No username)"}
                </td>
                <td className="huuk-td">{customer.email}</td>
                <td className="huuk-td">
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
