
import React, { createContext, useContext, useState, ReactNode } from 'react';

const PageHeaderContext = createContext<{
  headerActions: ReactNode;
  setHeaderActions: (actions: ReactNode) => void;
  headerLeft: ReactNode;
  setHeaderLeft: (content: ReactNode) => void;
}>({ headerActions: null, setHeaderActions: () => {}, headerLeft: null, setHeaderLeft: () => {} });

export const PageHeaderProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [headerActions, setHeaderActions] = useState<ReactNode>(null);
  const [headerLeft, setHeaderLeft] = useState<ReactNode>(null);
  return (
    <PageHeaderContext.Provider value={{ headerActions, setHeaderActions, headerLeft, setHeaderLeft }}>
      {children}
    </PageHeaderContext.Provider>
  );
};

export const usePageHeader = () => useContext(PageHeaderContext);
