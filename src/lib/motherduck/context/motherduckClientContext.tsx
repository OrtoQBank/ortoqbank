'use client';

import 'core-js/actual/promise/with-resolvers';

import type {
  MaterializedQueryResult,
  MDConnection,
  SafeQueryResult,
} from '@motherduck/wasm-client';
import { createContext, useContext, useEffect, useMemo, useRef } from 'react';

import { fetchMotherDuckToken } from '../functions/fetchMotherDuckToken';
import initMotherDuckConnection from '../functions/initMotherDuckConnection';

// Safe interface for using the connection
interface MotherDuckContextValue {
  evaluateQuery: (query: string) => Promise<MaterializedQueryResult>;
  safeEvaluateQuery: (
    query: string,
  ) => Promise<SafeQueryResult<MaterializedQueryResult>>;
}

export const MotherDuckContext = createContext<MotherDuckContextValue | null>(
  null,
);

export function MotherDuckClientProvider({
  children,
  database,
}: {
  children: React.ReactNode;
  database?: string;
}) {
  const connectionRef = useRef<
    PromiseWithResolvers<MDConnection | undefined> | undefined
  >(undefined);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  if (connectionRef.current === undefined) {
    connectionRef.current = Promise.withResolvers<MDConnection | undefined>();
  }

  const evaluateQuery = async (
    query: string,
  ): Promise<MaterializedQueryResult> => {
    if (!connectionRef.current) {
      throw new Error('MotherDuck connection ref is falsy');
    }

    const connection = await connectionRef.current.promise;

    if (!connection) {
      throw new Error('No MotherDuck connection available');
    }

    return connection.evaluateQuery(query);
  };

  const safeEvaluateQuery = async (
    query: string,
  ): Promise<SafeQueryResult<MaterializedQueryResult>> => {
    if (!connectionRef.current) {
      throw new Error('MotherDuck connection ref is falsy');
    }

    const connection = await connectionRef.current.promise;

    if (!connection) {
      throw new Error('No MotherDuck connection available');
    }

    return connection.safeEvaluateQuery(query);
  };

  useEffect(() => {
    const initializeConnection = async () => {
      try {
        const mdToken = await fetchMotherDuckToken();
        const result = await initMotherDuckConnection(mdToken, database);
        if (connectionRef.current) {
          connectionRef.current.resolve(result);
        }

        // Store cleanup function
        cleanupRef.current = async () => {
          if (result) {
            try {
              // Set database instance TTL to zero to force cleanup
              // This is the recommended way to clean up MotherDuck connections
              await result.evaluateQuery(
                "SET motherduck_dbinstance_inactivity_ttl='0ms'",
              );
              console.log('MotherDuck connection cleanup initiated');
            } catch (cleanupError) {
              console.warn('Error during connection cleanup:', cleanupError);
            }
          }
        };
      } catch (error) {
        console.error(error);
        if (connectionRef.current) {
          connectionRef.current.reject(error);
        }
      }
    };
    initializeConnection();

    // Cleanup function that runs when component unmounts or database changes
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = undefined;
      }
      // Reset connection ref for new database
      if (connectionRef.current) {
        connectionRef.current = Promise.withResolvers<
          MDConnection | undefined
        >();
      }
    };
  }, [database]);

  const value = useMemo(
    () => ({
      evaluateQuery,
      safeEvaluateQuery,
    }),
    [],
  );

  return (
    <MotherDuckContext.Provider value={value}>
      {children}
    </MotherDuckContext.Provider>
  );
}

export function useMotherDuckClientState() {
  const context = useContext(MotherDuckContext);
  if (!context) {
    throw new Error(
      'useMotherDuckClientState must be used within MotherDuckClientStateProvider',
    );
  }
  return context;
}
