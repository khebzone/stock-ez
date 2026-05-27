import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ConfigProvider, Grid } from 'antd';
import { store } from './store';
import App from './App';
import { antdTheme } from './styles/tokens';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

const ResponsiveThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const screens = Grid.useBreakpoint();
  const isMobile = screens.md === false;

  const theme = isMobile
    ? {
        ...antdTheme,
        token: {
          ...antdTheme.token,
          controlHeight: 40,
          fontSize: 15,
        },
      }
    : antdTheme;

  return <ConfigProvider theme={theme}>{children}</ConfigProvider>;
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <Provider store={store}>
        <ResponsiveThemeProvider>
          <App />
        </ResponsiveThemeProvider>
      </Provider>
    </ErrorBoundary>
  </React.StrictMode>
);
