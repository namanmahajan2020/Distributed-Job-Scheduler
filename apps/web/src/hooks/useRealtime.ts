import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";

export const useRealtime = (events: string[], queryKeys: string[][]) => {
  const queryClient = useQueryClient();

  useEffect(() => {
    const socket = io("http://localhost:4000");
    const invalidate = () => {
      queryKeys.forEach((key) => {
        void queryClient.invalidateQueries({ queryKey: key });
      });
    };

    events.forEach((event) => socket.on(event, invalidate));

    return () => {
      events.forEach((event) => socket.off(event, invalidate));
      socket.disconnect();
    };
  }, [events, queryClient, queryKeys]);
};
