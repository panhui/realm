package main

import (
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"testing"
)

func TestValidateForwardingRuleWithRoundRobin(t *testing.T) {
	rule := ForwardingRule{
		Listen:       "[::]:10000",
		Remote:       "10.0.0.11:443",
		ExtraRemotes: []string{"10.0.0.12:443", "[2001:db8::13]:443"},
		Balance:      "roundrobin: 2, 1, 1",
	}

	if err := validateForwardingRule(rule); err != nil {
		t.Fatalf("expected valid rule, got %v", err)
	}
}

func TestValidateForwardingRuleWithIPHash(t *testing.T) {
	rule := ForwardingRule{
		Listen:       "0.0.0.0:10000",
		Remote:       "node-a.example.com:443",
		ExtraRemotes: []string{"node-b.example.com:443"},
		Balance:      "iphash: 1, 1",
	}

	if err := validateForwardingRule(rule); err != nil {
		t.Fatalf("expected valid rule, got %v", err)
	}
}

func TestValidateForwardingRuleRejectsInvalidLoadBalancing(t *testing.T) {
	tests := []struct {
		name    string
		rule    ForwardingRule
		message string
	}{
		{
			name: "missing strategy",
			rule: ForwardingRule{
				Listen:       "[::]:10000",
				Remote:       "10.0.0.11:443",
				ExtraRemotes: []string{"10.0.0.12:443"},
			},
			message: "必须设置负载均衡策略",
		},
		{
			name: "unsupported strategy",
			rule: ForwardingRule{
				Listen:       "[::]:10000",
				Remote:       "10.0.0.11:443",
				ExtraRemotes: []string{"10.0.0.12:443"},
				Balance:      "random: 1, 1",
			},
			message: "不支持的负载均衡策略",
		},
		{
			name: "wrong weight count",
			rule: ForwardingRule{
				Listen:       "[::]:10000",
				Remote:       "10.0.0.11:443",
				ExtraRemotes: []string{"10.0.0.12:443"},
				Balance:      "roundrobin: 1",
			},
			message: "权重数量必须与远端数量一致",
		},
		{
			name: "zero weight",
			rule: ForwardingRule{
				Listen:       "[::]:10000",
				Remote:       "10.0.0.11:443",
				ExtraRemotes: []string{"10.0.0.12:443"},
				Balance:      "roundrobin: 1, 0",
			},
			message: "权重必须是大于 0 的整数",
		},
		{
			name: "duplicate remote",
			rule: ForwardingRule{
				Listen:       "[::]:10000",
				Remote:       "10.0.0.11:443",
				ExtraRemotes: []string{"10.0.0.11:443"},
				Balance:      "roundrobin: 1, 1",
			},
			message: "远端地址不能重复",
		},
		{
			name: "invalid extra remote",
			rule: ForwardingRule{
				Listen:       "[::]:10000",
				Remote:       "10.0.0.11:443",
				ExtraRemotes: []string{"10.0.0.12"},
				Balance:      "roundrobin: 1, 1",
			},
			message: "格式无效",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateForwardingRule(tt.rule)
			if err == nil || !strings.Contains(err.Error(), tt.message) {
				t.Fatalf("expected error containing %q, got %v", tt.message, err)
			}
		})
	}
}

func TestSaveAndLoadConfigPreservesLoadBalancing(t *testing.T) {
	originalPath := realmConfigPath
	originalConfig := config
	t.Cleanup(func() {
		realmConfigPath = originalPath
		config = originalConfig
	})

	realmConfigPath = filepath.Join(t.TempDir(), "config.toml")
	config = Config{}
	config.Network.UseUDP = true
	config.Endpoints = []ForwardingRule{
		{
			Listen:       "[::]:10000",
			Remote:       "10.0.0.11:443",
			ExtraRemotes: []string{"10.0.0.12:443", "10.0.0.13:443"},
			Balance:      "roundrobin: 2, 1, 1",
		},
	}

	if err := SaveConfig(); err != nil {
		t.Fatal(err)
	}
	contents, err := os.ReadFile(realmConfigPath)
	if err != nil {
		t.Fatal(err)
	}
	for _, expected := range []string{
		`extra_remotes = ["10.0.0.12:443", "10.0.0.13:443"]`,
		`balance = "roundrobin: 2, 1, 1"`,
	} {
		if !strings.Contains(string(contents), expected) {
			t.Fatalf("saved config does not contain %q:\n%s", expected, contents)
		}
	}

	config = Config{}
	if err := LoadConfig(); err != nil {
		t.Fatal(err)
	}

	want := ForwardingRule{
		Listen:       "[::]:10000",
		Remote:       "10.0.0.11:443",
		ExtraRemotes: []string{"10.0.0.12:443", "10.0.0.13:443"},
		Balance:      "roundrobin: 2, 1, 1",
	}
	if len(config.Endpoints) != 1 || !reflect.DeepEqual(config.Endpoints[0], want) {
		t.Fatalf("round trip mismatch: %#v", config.Endpoints)
	}
}

func TestSaveConfigOmitsEmptyLoadBalancingFields(t *testing.T) {
	originalPath := realmConfigPath
	originalConfig := config
	t.Cleanup(func() {
		realmConfigPath = originalPath
		config = originalConfig
	})

	realmConfigPath = filepath.Join(t.TempDir(), "config.toml")
	config = Config{
		Endpoints: []ForwardingRule{
			{Listen: "[::]:10000", Remote: "10.0.0.11:443"},
		},
	}

	if err := SaveConfig(); err != nil {
		t.Fatal(err)
	}
	contents, err := os.ReadFile(realmConfigPath)
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(string(contents), "extra_remotes") || strings.Contains(string(contents), "balance") {
		t.Fatalf("single-remote config contains empty load-balancing fields:\n%s", contents)
	}
}
