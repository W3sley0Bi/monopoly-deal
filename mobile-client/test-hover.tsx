import { Pressable } from 'react-native';
export const Test = () => <Pressable style={({ hovered }: any) => [{ backgroundColor: hovered ? 'red' : 'blue' }]} />;
