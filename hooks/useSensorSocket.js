import { useEffect, useState } from 'react';
import io from 'socket.io-client';

export const useSensorSocket = () => {
  const [data, setData] = useState(null);

  useEffect(() => {
    const socket = io('https://d989-223-123-15-194.ngrok-free.app/');

    socket.on('sensorData', (newData) => {
      console.log('Received sensor data:', newData);
      setData(newData);
    });

    return () => socket.disconnect();
  }, []);

  return data;
};
