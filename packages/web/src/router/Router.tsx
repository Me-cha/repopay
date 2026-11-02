import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

interface RouterContextType {
  path: string;
  search: string;
  navigate: (to: string) => void;
}

const RouterContext = createContext<RouterContextType>({
  path: typeof window !== 'undefined' ? window.location.pathname : '/',
  search: typeof window !== 'undefined' ? window.location.search : '',
  navigate: () => {},
});

export function RouterProvider({ children }: { children: ReactNode }) {
  const [path, setPath] = useState(typeof window !== 'undefined' ? window.location.pathname : '/');
  const [search, setSearch] = useState(typeof window !== 'undefined' ? window.location.search : '');

  useEffect(() => {
    const handlePopState = () => {
      setPath(window.location.pathname);
      setSearch(window.location.search);
    };
    window.addEventListener('popstate', handlePopState);
    return () => { window.removeEventListener('popstate', handlePopState); };
  }, []);

  const navigate = (to: string) => {
    const [newPath = '/', newSearch = ''] = to.split('?');
    window.history.pushState(null, '', to);
    setPath(newPath);
    setSearch(newSearch ? `?${newSearch}` : '');
  };

  return (
    <RouterContext.Provider value={{ path, search, navigate }}>
      {children}
    </RouterContext.Provider>
  );
}

export function useRouter() {
  return useContext(RouterContext);
}
