import { View, Text } from 'react-native';

export default function HomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white dark:bg-gray-900">
      <Text className="text-2xl font-bold text-indigo-500">Halvy</Text>
      <Text className="text-sm text-gray-500 mt-2">Infrastructure smoke test</Text>
    </View>
  );
}
