package com.stockez.api.security.service;

import com.stockez.api.module.user.entity.User;
import com.stockez.api.module.user.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/**
 * Loads user from DB for Spring Security authentication.
 */
@Service
@RequiredArgsConstructor
public class StockEzUserDetailsService implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(String phone) throws UsernameNotFoundException {
        User user = userRepository.findByPhoneAndActiveTrue(phone)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + phone));
        return toUserDetails(user);
    }

    public UserDetails loadByUserId(UUID userId) throws UsernameNotFoundException {
        User user = userRepository.findByIdAndActiveTrue(userId)
                .orElseThrow(() -> new UsernameNotFoundException("User not found: " + userId));
        return toUserDetails(user);
    }

    private UserDetails toUserDetails(User user) {
        return org.springframework.security.core.userdetails.User.builder()
                .username(user.getId().toString())
                .password(user.getPasswordHash())
                .authorities(List.of(new SimpleGrantedAuthority("ROLE_" + user.getRole().name())))
                .accountExpired(false)
                .accountLocked(!user.isActive())
                .credentialsExpired(false)
                .disabled(!user.isActive())
                .build();
    }
}
