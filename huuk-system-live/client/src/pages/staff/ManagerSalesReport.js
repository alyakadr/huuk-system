import React from 'react';

const ManagerSalesReport = () => {
  // Show alert when component is accessed
  React.useEffect(() => {
    alert("display only");
  }, []);
  return (
    <div>
      <h2>Manager Sales Report</h2>
      <p>This component is under development.</p>
    </div>
  );
};

export default ManagerSalesReport;
