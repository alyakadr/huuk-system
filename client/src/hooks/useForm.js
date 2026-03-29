import { useCallback, useState } from "react";

export const useForm = (initialValues) => {
  const [values, setValues] = useState(initialValues);

  const setFieldValue = useCallback((fieldName, fieldValue) => {
    setValues((previousValues) => ({
      ...previousValues,
      [fieldName]: fieldValue,
    }));
  }, []);

  const handleInputChange = useCallback(
    (event) => {
      const { name, value } = event.target;
      setFieldValue(name, value);
    },
    [setFieldValue],
  );

  const resetForm = useCallback(
    (nextValues = initialValues) => {
      setValues(nextValues);
    },
    [initialValues],
  );

  return {
    values,
    setValues,
    setFieldValue,
    handleInputChange,
    resetForm,
  };
};
