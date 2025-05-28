import { View, Text, TouchableOpacity } from 'react-native';
import React, { useState, useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { Drawer } from 'react-native-paper';
import { SafeAreaView } from 'react-native-safe-area-context';
import { widthPercentageToDP as wp, heightPercentageToDP as hp } from 'react-native-responsive-screen';
import { Octicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { StatusBar } from 'expo-status-bar';

export default function _layout() {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [userName, setUserName] = useState('');
  const router = useRouter();

  useEffect(() => {
    // Get user data from AsyncStorage on component mount
    const getUserData = async () => {
      try {
        const userData = await AsyncStorage.getItem('user');
        if (userData) {
          const parsedUser = JSON.parse(userData);
          setUserRole(parsedUser.role);
          setUserName(`${parsedUser.firstName} ${parsedUser.lastName}`);
        }
      } catch (error) {
        console.error('Error getting user data:', error);
      }
    };

    getUserData();
  }, []);

  const handleNavigation = (route) => {
    router.push(route);
    setDrawerOpen(false);
  };

  const handleLogout = async () => {
    try {
      // Clear user data from AsyncStorage
      await AsyncStorage.removeItem('user');
      // Navigate to sign in screen
      router.replace('/signin');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  // Content for the drawer sidebar
  const renderDrawerContent = () => (
    <View style={{ flex: 1, backgroundColor: '#fff', width: wp(70) }}>
      {/* User profile section */}
      <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#e5e5e5' }}>
        <View style={{ 
          height: hp(8), 
          width: hp(8), 
          borderRadius: hp(4), 
          backgroundColor: '#4f46e5', 
          justifyContent: 'center', 
          alignItems: 'center', 
          marginBottom: 12 
        }}>
          <Text style={{ fontSize: hp(3), color: 'white', fontWeight: 'bold' }}>
            {userName ? userName.charAt(0) : 'U'}
          </Text>
        </View>
        <Text style={{ fontSize: hp(2.2), fontWeight: 'bold' }}>{userName || 'User'}</Text>
        <Text style={{ fontSize: hp(1.8), color: 'gray' }}>{userRole || 'Loading...'}</Text>
      </View>
      
      {/* Navigation items */}
      <View style={{ flex: 1, paddingTop: 8 }}>
        {userRole !== 'physiotherapist' && (
          <>
            <Drawer.Item
              icon={({ color, size }) => <Octicons name="home" color={color} size={size} />}
              label="Home"
              onPress={() => handleNavigation('/home')}
            />
            <Drawer.Item
              icon={({ color, size }) => <Octicons name="person" color={color} size={size} />}
              label="Monitor Posture"
              onPress={() => handleNavigation('/postureStatus')}
            />
            <Drawer.Item
              icon={({ color, size }) => <Octicons name="pulse" color={color} size={size} />}
              label="Physiotherapist"
              onPress={() => handleNavigation('/physiosettings')}
            />
          </>
        )}
        <Drawer.Item
          icon={({ color, size }) => <Octicons name="sign-out" color={color} size={size} />}
          label="Logout"
          onPress={handleLogout}
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="dark" />
      
      {/* Main content */}
      <View style={{ flex: 1 }}>
        {/* Toggle button for drawer */}
        {userRole && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: hp(2),
              left: wp(5),
              zIndex: 10,
              padding: 8,
            }}
            onPress={() => setDrawerOpen(!drawerOpen)}
          >
            <Octicons name="three-bars" size={hp(3.5)} color="#4f46e5" />
          </TouchableOpacity>
        )}
        
        {/* Drawer sidebar */}
        {drawerOpen && (
          <View style={{ 
            position: 'absolute', 
            left: 0, 
            top: 0, 
            bottom: 0, 
            zIndex: 100,
            elevation: 5,
            shadowColor: '#000',
            shadowOffset: { width: 2, height: 0 },
            shadowOpacity: 0.3,
            shadowRadius: 5,
          }}>
            {renderDrawerContent()}
          </View>
        )}
        
        {/* Backdrop when drawer is open */}
        {drawerOpen && (
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 99,
            }}
            onPress={() => setDrawerOpen(false)}
          />
        )}
        
        {/* Main screen content */}
        <Stack 
          screenOptions={{
            headerShown: false,
            contentStyle: { paddingTop: hp(2) }
          }}
        />
      </View>
    </SafeAreaView>
  );
}