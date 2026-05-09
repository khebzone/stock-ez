import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { ConfigProvider } from 'antd';
import { store } from './store';
import App from './App';
import { antdTheme } from './styles/tokens';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Provider store={store}>
      <ConfigProvider theme={antdTheme}>
        <App />
      </ConfigProvider>
    </Provider>
  </React.StrictMode>
);
