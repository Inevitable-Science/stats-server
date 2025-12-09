import { sleep } from "../../../../utils/utils";
import type { AxiosResponse } from "axios";
import axios from "axios";


export async function fetchWithRetry<T>(
  url: string,
  payload: any,
  maxRetries: number = 7,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response: AxiosResponse<T> = await axios.post(url, payload, {
        timeout: 20000,
      });
      const data = await response.data;
      return data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = parseFloat(error.response.headers["retry-after"] || "");
        const waitTime = !isNaN(retryAfter) ? retryAfter * 1000 : delay * 2 ** attempt;

        console.warn(`Rate limited. Retrying in ${waitTime / 1000} seconds...`);
        await sleep(waitTime);
      } else {
        throw error;
      }
    }
  }

  throw new Error(`Max retries exceeded for ${url}`);
}

export async function getWithRetry<T>(
  url: string,
  maxRetries: number = 7,
  delay: number = 1000
): Promise<T> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response: AxiosResponse<T> = await axios.get(url, {
        timeout: 20000,
      });
      return response.data;
    } catch (error: any) {
      if (error.response?.status === 429) {
        const retryAfter = parseFloat(error.response.headers["retry-after"] || "");
        const waitTime = !isNaN(retryAfter) ? retryAfter * 1000 : delay * 2 ** attempt;

        console.warn(`Rate limited. Retrying in ${waitTime / 1000} seconds...`);
        await sleep(waitTime);
      } else {
        throw error; // not a 429 → fail immediately
      }
    }
  }

  throw new Error(`Max retries exceeded for ${url}`);
}
