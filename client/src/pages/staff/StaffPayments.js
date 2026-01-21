import React from "react";

const StaffPayments = () => {
  // Show alert when component is accessed
  React.useEffect(() => {
    alert("display only");
  }, []);
  return (
    <div>
      <h1>Payment Management</h1>
      {/* Your schedule content here */}
    </div>
  );
};

export default StaffPayments;
