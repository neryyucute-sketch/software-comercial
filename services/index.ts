// services/index.ts
import { USE_MOCK } from './config';
import * as mock from './mock';
import * as api from './api';

/** Punto único de datos de la app */
export const svc = USE_MOCK ? mock : api;
export default svc;
