jest.mock('react-native-reanimated', () => {
    const View = require('react-native').View;
    const chain = () => chainObj;
    const chainObj = {
        springify: chain,
        damping: chain,
        stiffness: chain,
        mass: chain,
        duration: chain,
        easing: chain,
        delay: chain,
        build: chain
    };
    return {
        __esModule: true,
        default: {
            createAnimatedComponent: (c) => c,
            View,
            Text: require('react-native').Text,
            Image: require('react-native').Image,
            ScrollView: require('react-native').ScrollView,
            FlatList: require('react-native').FlatList,
        },
        useSharedValue: jest.fn(() => ({ value: 0 })),
        useAnimatedStyle: jest.fn(() => ({})),
        useDerivedValue: jest.fn(() => ({ value: 0 })),
        useAnimatedReaction: jest.fn(),
        withTiming: jest.fn((v) => v),
        withSpring: jest.fn((v) => v),
        withDelay: jest.fn((_, v) => v),
        withSequence: jest.fn((...args) => args[0]),
        withRepeat: jest.fn((v) => v),
        LinearTransition: chainObj,
        Easing: { inOut: jest.fn(), ease: jest.fn(), back: jest.fn(), linear: jest.fn(), out: jest.fn(), in: jest.fn() },
    };
});
