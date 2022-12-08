import styled, { createGlobalStyle } from 'styled-components';
import * as palette from '@styles/Variables';

const GlobalStyle = createGlobalStyle`
  html, body, #root {
    height: 100%;
  }

  * {
    font-family: 'BM Hanna';
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }
`;

export const MainLayout = styled.div`
  width: 100%;
  max-width: 420px;
  height: 100%;
  margin: 0 auto;
  border: 3px solid ${palette.BORDER};
  overflow: hidden;

  @media (max-width: ${palette.BREAKPOINT_TABLET}) {
    border: 0;
  }
`;

export default GlobalStyle;
