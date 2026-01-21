import React from 'react';

const StaffManagement = () => {
  // Show alert when component is accessed
  React.useEffect(() => {
    alert("display only");
  }, []);
  return (
    <div>
      <h2>Staff Management</h2>
      <p>This component is under development.</p>
    </div>
  );
};

export default StaffManagement;
